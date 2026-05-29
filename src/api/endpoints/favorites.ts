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

    add: (provider_id: number) =>
      api.post<{ success: boolean }>('/v1/favorites', { provider_id: provider_id }),

    remove: (favoriteId: number) =>
      api.del<{ success: boolean }>(`/v1/favorites/${favoriteId}`),

    check: (provider_id: number) =>
      api.get<{ is_favorite: boolean }>(`/v1/favorites/check/${provider_id}`),
  };
}
