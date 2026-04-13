import type { ReservationStatus } from '../types/interfaces';

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, { fr: string; en: string }> = {
  pending_payment: { fr: 'En attente de paiement', en: 'Pending payment' },
  pending: { fr: 'En attente', en: 'Pending' },
  confirmed: { fr: 'Confirmée', en: 'Confirmed' },
  deposit_paid: { fr: 'Acompte payé', en: 'Deposit paid' },
  payment_failed: { fr: 'Paiement échoué', en: 'Payment failed' },
  refunded: { fr: 'Remboursée', en: 'Refunded' },
  canceled: { fr: 'Annulée', en: 'Canceled' },
  completed: { fr: 'Terminée', en: 'Completed' },
  payment_processing: { fr: 'Paiement en cours', en: 'Payment processing' },
  deposit_processing: { fr: 'Acompte en cours', en: 'Deposit processing' },
  awaiting_balance: { fr: 'En attente du solde', en: 'Awaiting balance' },
  debt_collection: { fr: 'Recouvrement', en: 'Debt collection' },
};
