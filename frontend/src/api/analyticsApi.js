import apiClient from './client';

export const analyticsApi = {
  getSummaryKPIs: async (eventId) => {
    return apiClient(`/analytics/${eventId}/summary`);
  },

  getSessionHeatmaps: async (eventId) => {
    return apiClient(`/analytics/${eventId}/heatmaps`);
  },

  getSponsorMetrics: async (eventId) => {
    return apiClient(`/analytics/${eventId}/sponsors`);
  },

  getFeedbackAnalytics: async (eventId) => {
    return apiClient(`/analytics/${eventId}/feedback`);
  },
};

export default analyticsApi;
