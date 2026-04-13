import type { ApiClient } from '../createApiClient';

export interface Profile {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  image?: string;
  job_title?: string;
  company_name?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  country?: string;
  bio?: string;
  languages?: string[];
  created_at: string;
}

export interface ProviderProfile extends Profile {
  rating: number;
  review_count: number;
  completed_audits: number;
  categories: string[];
  norms: string[];
  hourly_rate?: number;
  response_time?: string;
  is_verified: boolean;
  portfolio_images?: string[];
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  bio?: string;
}

export function createProfileEndpoints(api: ApiClient) {
  return {
    getMyProfile: () =>
      api.get<Profile>('/v1/profile'),

    updateProfile: (data: UpdateProfileRequest) =>
      api.put<Profile>('/v1/profile', data),

    updateName: (firstName: string, lastName: string) =>
      api.put<{ success: boolean }>('/v1/profile/name', {
        first_name: firstName,
        last_name: lastName,
      }),

    updateAvatar: (formData: FormData) =>
      api.putFormData<{ image_url: string }>('/v1/profile/image', formData),

    getProviderProfile: (providerId: number) =>
      api.get<ProviderProfile>(`/v1/providers/${providerId}/profile`),

    getProviderReviews: (providerId: number, page = 1, pageSize = 10) =>
      api.get<{ reviews: Review[]; total: number }>(
        `/v1/providers/${providerId}/reviews?page=${page}&page_size=${pageSize}`,
      ),
  };
}

export interface Review {
  id: number;
  reviewer_name: string;
  reviewer_image?: string;
  rating: number;
  comment: string;
  created_at: string;
}
