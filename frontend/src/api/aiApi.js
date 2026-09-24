import apiClient from './client';

export const aiApi = {
  generateEventCopy: async (payload) => {
    return apiClient('/ai/generate-event-copy', {
      method: 'POST',
      body: payload,
    });
  },

  generateSpeakerBio: async (payload) => {
    return apiClient('/ai/generate-speaker-bio', {
      method: 'POST',
      body: payload,
    });
  },

  generateAnnouncement: async (payload) => {
    return apiClient('/ai/generate-announcement', {
      method: 'POST',
      body: payload,
    });
  },

  getRecommendations: async (eventId) => {
    return apiClient(`/ai/recommendations/${eventId}`);
  },
};

export default aiApi;
