import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types/interfaces';

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'partaudit_access_token',
  REFRESH_TOKEN: 'partaudit_refresh_token',
  ACCESS_EXPIRES: 'partaudit_access_expires_at',
  REFRESH_EXPIRES: 'partaudit_refresh_expires_at',
  USER_DATA: 'partaudit_user_data',
} as const;

/** Buffer in seconds before token expiry to trigger refresh */
const EXPIRY_BUFFER_SECONDS = 60;

// Robust expires_at parser. The backend can return:
//   - numeric seconds since epoch (e.g. "1735689600")
//   - numeric milliseconds since epoch (e.g. "1735689600000")
//   - ISO date string (e.g. "2026-12-31T23:59:59Z")
// Returns the timestamp in milliseconds, or null when the input can't
// be parsed — caller should treat null as "unknown, don't expire" so
// we never lock a user out because of a format we don't recognise.
function parseExpiresAtMs(value: string | null | undefined): number | null {
  if (!value) return null;
  // Try numeric first
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) {
    // Anything below ~Sep 2001 in seconds (1e12) is treated as seconds.
    return num > 1e12 ? num : num * 1000;
  }
  // Fall back to ISO date string
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

interface AuthState {
  user: User['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  /** Base URL for the auth API (e.g. https://api.devpartaudit.xyz/app/partaudit) */
  apiBaseUrl: string;
  /** Called after logout to redirect to login screen */
  onLogout?: () => void;
}

export function AuthProvider({ children, apiBaseUrl, onLogout }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshMutex = useRef(false);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const [refresh_token, refreshExpiresAt, userData] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_EXPIRES),
        SecureStore.getItemAsync(TOKEN_KEYS.USER_DATA),
      ]);

      // No refresh token = never logged in OR explicitly logged out.
      if (!refresh_token || !userData) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Pre-check the refresh expiry only when we can confidently parse
      // it. If parsing fails (unknown format), we trust the stored
      // session and let the API client's 401 path bump the user out
      // when the refresh actually fails — same behaviour as
      // mobile-client. This avoids logging out users on every restart
      // because of a format mismatch we didn't anticipate.
      const refreshExpiryMs = parseExpiresAtMs(refreshExpiresAt);
      if (refreshExpiryMs !== null && Date.now() >= refreshExpiryMs) {
        await clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const user = JSON.parse(userData);
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }

  async function storeTokens(data: User) {
    // Coerce expires_at to string — SecureStore requires strings, and the
    // backend can return either string ISO timestamps or numeric epoch seconds
    // depending on the endpoint version.
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, data.access_token),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, data.refresh_token),
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_EXPIRES, String(data.access_token_expires_at)),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_EXPIRES, String(data.refresh_token_expires_at)),
      SecureStore.setItemAsync(TOKEN_KEYS.USER_DATA, JSON.stringify(data.user)),
    ]);
  }

  async function clearTokens() {
    await Promise.all(
      Object.values(TOKEN_KEYS).map((key) => SecureStore.deleteItemAsync(key)),
    );
  }

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${apiBaseUrl}/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw errorData;
    }

    const data: User = await response.json();
    await storeTokens(data);
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
    return data;
  }, [apiBaseUrl]);

  const logout = useCallback(async () => {
    await clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
    onLogout?.();
  }, [onLogout]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const [access_token, accessExpiresAt] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_EXPIRES),
    ]);

    if (!access_token) return null;

    // If we can't confidently parse the expiry, return the token as-is
    // and let the backend reject it with 401 — same lazy-validation
    // strategy as restoreSession.
    const expiresMs = parseExpiresAtMs(accessExpiresAt);
    const isExpired =
      expiresMs !== null && Date.now() >= expiresMs - EXPIRY_BUFFER_SECONDS * 1000;

    if (!isExpired) return access_token;

    // Token expired — refresh it
    if (refreshMutex.current) {
      // Another refresh is in progress, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    }

    refreshMutex.current = true;
    try {
      const refresh_token = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
      if (!refresh_token) {
        await logout();
        return null;
      }

      // Backend expects refresh_token in the body, not as Bearer header.
      // Returning shape: { access_token, access_token_expires_at,
      // refresh_token?, refresh_token_expires_at? } — we rotate the refresh
      // token when the server rotates it, otherwise keep the existing one.
      const response = await fetch(`${apiBaseUrl}/refresh-access-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh_token }),
      });

      if (!response.ok) {
        await logout();
        return null;
      }

      const data = await response.json();
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, data.access_token);
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_EXPIRES, String(data.access_token_expires_at));
      // Backend may rotate the refresh token (when nearing expiry). Persist
      // the new pair when present, otherwise keep the existing one.
      if (data.refresh_token) {
        await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, data.refresh_token);
      }
      if (data.refresh_token_expires_at) {
        await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_EXPIRES, String(data.refresh_token_expires_at));
      }

      return data.access_token;
    } catch {
      await logout();
      return null;
    } finally {
      refreshMutex.current = false;
    }
  }, [apiBaseUrl, logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
