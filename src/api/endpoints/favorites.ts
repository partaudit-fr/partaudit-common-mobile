import type { ApiClient } from '../createApiClient';

export interface Favorite {
  id: number;
  user_id: number;
  provider_id: number;
  provider_name: string;
  provider_image?: string;
  provider_city?: string;
  provider_rating: number;
  created_at: string;
}

export function createFavoritesEndpoints(api: ApiClient) {
  return {
    list: () =>
      api.get<{ favorites: Favorite[] }>('/v1/favorites'),

    add: (providerId: number) =>
      api.post<{ success: boolean }>('/v1/favorites', { provider_id: providerId }),

    remove: (favoriteId: number) =>
      api.del<{ success: boolean }>(`/v1/favorites/${favoriteId}`),

    check: (providerId: number) =>
      api.get<{ is_favorite: boolean }>(`/v1/favorites/check/${providerId}`),
  };
}
