import type { ApiClient } from '../createApiClient';
import type { User } from '../../types/interfaces';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export function createAuthEndpoints(api: ApiClient) {
  return {
    login: (data: LoginRequest) =>
      api.post<User>('/v1/authenticate', data),

    register: (data: RegisterRequest) =>
      api.post<User>('/v1/register', data),

    refreshToken: (refreshToken: string) =>
      api.post<{ access_token: string; access_token_expires_at: string }>(
        '/v1/refresh-access-token',
        { refresh_token: refreshToken },
      ),

    verifyEmail: (userId: string, code: string) =>
      api.get<{ success: boolean }>(`/v1/users/${userId}/code/${code}/validate`),

    renewVerificationCode: (userId: string) =>
      api.post<{ success: boolean }>(`/v1/users/${userId}/renew-code`, {}),

    forgotPassword: (data: ForgotPasswordRequest) =>
      api.post<{ success: boolean }>('/v1/forgot-password', data),

    resetPassword: (data: ResetPasswordRequest) =>
      api.post<{ success: boolean }>('/v1/reset-password', data),
  };
}
