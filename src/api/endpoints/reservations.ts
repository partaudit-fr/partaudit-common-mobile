import type { ApiClient } from '../createApiClient';
import type { ReservationStatus, PaymentType } from '../../types/interfaces';

export interface Reservation {
  id: string;
  client_id: number;
  provider_id: number;
  provider_name: string;
  provider_image?: string;
  client_name: string;
  client_image?: string;
  category_name: string;
  norm_name?: string;
  status: ReservationStatus;
  payment_type: PaymentType;
  payment_status: string;
  amount: number;
  deposit_amount?: number;
  commission_amount?: number;
  scheduled_date: string;
  scheduled_time?: string;
  duration_minutes?: number;
  address?: string;
  city?: string;
  postal_code?: string;
  notes?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationListResponse {
  reservations: Reservation[];
  total: number;
}

export interface ConfirmReservationRequest {
  reservation_id: string;
}

export interface CancelReservationRequest {
  reason: string;
}

export interface CancellationCalculation {
  refund_amount: number;
  penalty_amount: number;
  refund_percentage: number;
  policy_name: string;
}

export function createReservationEndpoints(api: ApiClient) {
  return {
    list: (page = 1, pageSize = 20, status?: ReservationStatus) => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (status) params.set('status', status);
      return api.get<ReservationListResponse>(`/v1/reservations?${params}`);
    },

    getById: (id: string) =>
      api.get<Reservation>(`/v1/reservations/${id}`),

    confirm: (id: string) =>
      api.put<{ success: boolean }>(`/v1/reservations/${id}/confirm`, {}),

    reject: (id: string, reason: string) =>
      api.put<{ success: boolean }>(`/v1/reservations/${id}/refuse`, { reason }),

    cancel: (id: string, data: CancelReservationRequest) =>
      api.put<{ success: boolean }>(`/v1/reservations/${id}/cancel`, data),

    markCompleted: (id: string) =>
      api.put<{ success: boolean }>(`/v1/reservations/${id}/complete`, {}),

    getCancellationCalculation: (id: string) =>
      api.get<CancellationCalculation>(`/v1/reservations/${id}/cancellation-calculation`),

    getAvailableSlots: (providerId: number, date: string) =>
      api.get<{ slots: string[] }>(`/v1/providers/${providerId}/available-slots?date=${date}`),
  };
}
