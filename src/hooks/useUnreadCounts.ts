// Unread counts hook — drives the badges on the bottom nav, the bell
// icon, and any other "you have stuff" surface. Polls every 30s and
// refreshes on screen focus / window focus / mount.
//
// Used by both mobile-client (existing) and mobile-pro. Takes an
// ApiClient instead of importing one so each app passes its own
// configured client.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../api/createApiClient';
import { useAuth } from '../providers/AuthProvider';

interface UnreadCountResponse {
  total_unread?: number;
  unread_count?: number;
}

interface NotificationsListResponse {
  notifications?: Array<{ read?: boolean; as_read?: boolean }>;
  items?: Array<{ read?: boolean; as_read?: boolean }>;
}

export interface UnreadCounts {
  messagesUnread: number;
  notifsUnread: number;
  total: number;
  refresh: () => void;
}

export function useUnreadCounts(api: ApiClient): UnreadCounts {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api.get<UnreadCountResponse>('/v1/unread-count').catch(() => ({} as UnreadCountResponse)),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const notifs = useQuery({
    queryKey: ['notifications-badge'],
    queryFn: () =>
      api
        .get<NotificationsListResponse>('/v1/notifications?page=1&page_size=20')
        .catch(() => ({} as NotificationsListResponse)),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const messagesUnread =
    unread.data?.total_unread ?? unread.data?.unread_count ?? 0;

  const notifItems =
    notifs.data?.notifications ??
    notifs.data?.items ??
    (Array.isArray(notifs.data) ? (notifs.data as any[]) : []);
  const notifsUnread = (notifItems ?? []).filter(
    (n: any) => !n.read && !n.as_read,
  ).length;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
  }, [queryClient]);

  return {
    messagesUnread,
    notifsUnread,
    total: messagesUnread + notifsUnread,
    refresh,
  };
}
