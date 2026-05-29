export enum Role {
  USER = 'user',
  PRESTATAIRE = 'prestataire',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export interface User {
  session_id: number;
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  session_locked: boolean;
  user: {
    id: number;
    email: string;
    role: Role[];
    phone: string;
    active: boolean;
    image: string;
    first_name: string;
    last_name: string;
    user_job_title: string;
    created_at: string;
  };
}

export type ReservationStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'deposit_paid'
  | 'payment_failed'
  | 'refunded'
  | 'canceled'
  | 'completed'
  | 'payment_processing'
  | 'deposit_processing'
  | 'awaiting_balance'
  | 'debt_collection';

export type PaymentType = 'full' | 'deposit';

export type PaymentStatus =
  | 'paid'
  | 'half_paid'
  | 'canceled'
  | 'refunded'
  | 'pending'
  | 'failed';

export interface NormChapter {
  id: number;
  norm_id: number;
  code: string;
  title: string;
  description?: string;
  parent_id?: number;
  displayOrder: number;
  is_auditable: boolean;
  children?: NormChapter[];
  created_at: string;
  updated_at: string;
}

export interface ReservationNormChapter {
  id: number;
  reservation_id: string;
  norm_chapter_id: number;
  chapter?: NormChapter;
  created_at: string;
}

export interface GetChaptersResponse {
  chapters: NormChapter[];
  total: number;
}

export interface GetReservationChaptersResponse {
  chapters: ReservationNormChapter[];
  total: number;
}

export interface AddReservationChaptersResponse {
  success: boolean;
  message: string;
}
