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
    // Client-side: their own reservations (booker_id == caller).
    listMine: () => api.get<{ items: Reservation[] }>(`/v1/booking/reservations`),

    // Provider/auditor-side: missions assigned to them. The same endpoint
    // route name back-end-side ("available") — historically meant
    // "available to me as the assigned auditor", not "open slots".
    listProviderMissions: () => api.get<{ items: Reservation[] }>(`/v1/booking/reservations/available`),

    getById: (id: string) =>
      api.get<Reservation>(`/v1/booking/reservations/${id}`),

    // Provider commands
    confirm: (id: string) =>
      api.putWithoutBody<{ success: boolean }>(`/v1/booking/reservations/${id}/confirm`),

    refuse: (id: string, data: { reason: string }) =>
      api.put<{ success: boolean }>(`/v1/booking/reservations/${id}/refuse`, data),

    markAuditCompleted: (id: string) =>
      api.putWithoutBody<{ success: boolean }>(`/v1/booking/reservations/${id}/audit-completed`),

    // Client commands
    cancelClient: (id: string, data: CancelReservationRequest) =>
      api.put<{ success: boolean }>(`/v1/booking/reservations/${id}/client-cancel`, data),

    getCancellationCalculation: (id: string) =>
      api.get<CancellationCalculation>(`/v1/booking/reservations/${id}/calculate-cancellation`),

    getHistory: (id: string) =>
      api.get<{
        entries: Array<{
          action: string;
          actor_user_id: number;
          actor_name: string;
          actor_role: string;
          occurred_at: string;
          details_json: string;
        }>;
      }>(`/v1/booking/reservations/${id}/history`),
  };
}
