export const HOLD_TYPES = {
  CHECKOUT: 'checkout',
  WAITLIST_CLAIM: 'waitlist_claim'
};

export const CHECKOUT_HOLD_MINUTES = 15;
export const WAITLIST_CLAIM_HOLD_HOURS = 24;

export const REGISTRATION_STATUS = {
  HELD: 'held',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  WAITLISTED: 'waitlisted',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected'
};

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  FREE: 'free'
};
