import apiClient from './client';

export const ticketsApi = {
  listTiersByEvent: async (eventId) => {
    return apiClient(`/tickets/event/${eventId}`);
  },

  createTier: async (tierData) => {
    return apiClient('/tickets', {
      method: 'POST',
      body: tierData,
    });
  },

  validateCoupon: async ({ code, eventId, tierId }) => {
    return apiClient('/coupons/validate', {
      method: 'POST',
      body: { code, eventId, tierId },
    });
  },

  holdTicket: async (holdData) => {
    return apiClient('/registrations/hold', {
      method: 'POST',
      body: holdData,
    });
  },

  joinWaitlist: async (waitlistData) => {
    return apiClient('/registrations/waitlist', {
      method: 'POST',
      body: waitlistData,
    });
  },

  getMyTickets: async () => {
    return apiClient('/registrations/my-tickets');
  },

  createPaymentIntent: async (registrationId) => {
    return apiClient('/payments/create-intent', {
      method: 'POST',
      body: { registrationId },
    });
  },

  verifyPayment: async ({ registrationId, paymentIntentId }) => {
    return apiClient('/payments/verify', {
      method: 'POST',
      body: { registrationId, paymentIntentId },
    });
  },
};

export default ticketsApi;
