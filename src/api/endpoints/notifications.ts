import type { ApiClient } from '../createApiClient';

export interface Notification {
  id: string;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export function createNotificationEndpoints(api: ApiClient) {
  return {
    list: (page = 1, pageSize = 20) =>
      api.getNotifications<NotificationListResponse>(
        `/v1/notifications?page=${page}&page_size=${pageSize}`,
      ),

    // Backend (huma-based notifications service) registers /read and
    // /read-all as POST endpoints — GET returns 405. Body is unused but
    // required by the API client signature.
    markAsRead: (id: string) =>
      api.post<{ success: boolean }>(`/v1/notifications/${id}/read`, {}),

    markAllAsRead: () =>
      api.post<{ success: boolean }>('/v1/notifications/read-all', {}),

    getUnreadCount: () =>
      api.getNotifications<{ count: number }>('/v1/notifications/unread-count'),

    registerDeviceToken: (token: string, platform: 'ios' | 'android') =>
      api.post<{ success: boolean }>('/v1/device-tokens', { token, platform }),

    unregisterDeviceToken: (token: string) =>
      api.del<{ success: boolean }>(`/v1/device-tokens/${encodeURIComponent(token)}`),
  };
}
