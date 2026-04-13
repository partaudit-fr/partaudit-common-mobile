import type { ApiClient } from '../createApiClient';

export interface SearchResult {
  user_id: number;
  first_name: string;
  last_name: string;
  image?: string;
  company_name?: string;
  city: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  review_count: number;
  hourly_rate?: number;
  categories: string[];
  norms: string[];
  is_verified: boolean;
  distance_km?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  page_size: number;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  norm?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  min_rating?: number;
  max_price?: number;
  is_verified?: boolean;
  sort_by?: 'rating' | 'price' | 'distance' | 'reviews';
  page?: number;
  page_size?: number;
}

export function createSearchEndpoints(api: ApiClient) {
  return {
    search: (filters: SearchFilters) =>
      api.postSearch<SearchResponse>('/v1/search', filters),

    getCategories: () =>
      api.get<{ categories: Category[] }>('/v1/categories'),

    getNorms: () =>
      api.get<{ norms: Norm[] }>('/v1/norms'),

    getSuggestions: (query: string) =>
      api.postSearch<{ suggestions: string[] }>('/v1/search/suggestions', { query }),
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  count: number;
}

export interface Norm {
  id: number;
  name: string;
  code: string;
  description?: string;
}
