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
  /** Base URL for the auth API (e.g. https://api.devpartaudit.fr/app/partaudit) */
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
      const [refreshToken, refreshExpiresAt, userData] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_EXPIRES),
        SecureStore.getItemAsync(TOKEN_KEYS.USER_DATA),
      ]);

      if (!refreshToken || !refreshExpiresAt) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Check if refresh token itself is expired
      const refreshExpiry = Number(refreshExpiresAt);
      if (Date.now() >= refreshExpiry * 1000) {
        await clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const user = userData ? JSON.parse(userData) : null;
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }

  async function storeTokens(data: User) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, data.access_token),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, data.refresh_token),
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_EXPIRES, data.access_token_expires_at),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_EXPIRES, data.refresh_token_expires_at),
      SecureStore.setItemAsync(TOKEN_KEYS.USER_DATA, JSON.stringify(data.user)),
    ]);
  }

  async function clearTokens() {
    await Promise.all(
      Object.values(TOKEN_KEYS).map((key) => SecureStore.deleteItemAsync(key)),
    );
  }

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${apiBaseUrl}/v1/authenticate`, {
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
    const [accessToken, accessExpiresAt] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_EXPIRES),
    ]);

    if (!accessToken || !accessExpiresAt) return null;

    const expiresAt = Number(accessExpiresAt);
    const isExpired = Date.now() >= (expiresAt - EXPIRY_BUFFER_SECONDS) * 1000;

    if (!isExpired) return accessToken;

    // Token expired — refresh it
    if (refreshMutex.current) {
      // Another refresh is in progress, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    }

    refreshMutex.current = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        await logout();
        return null;
      }

      const response = await fetch(`${apiBaseUrl}/v1/refresh-access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (!response.ok) {
        await logout();
        return null;
      }

      const data = await response.json();
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, data.access_token);
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_EXPIRES, data.access_token_expires_at);

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
