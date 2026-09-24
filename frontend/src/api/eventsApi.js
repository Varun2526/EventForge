import apiClient from './client';

export const eventsApi = {
  listEvents: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.type) query.append('type', params.type);
    if (params.status) query.append('status', params.status);
    const qs = query.toString();
    return apiClient(`/events${qs ? `?${qs}` : ''}`);
  },

  getEvent: async (id) => {
    return apiClient(`/events/${id}`);
  },

  createEvent: async (eventData) => {
    return apiClient('/events', {
      method: 'POST',
      body: eventData,
    });
  },

  updateEvent: async (id, eventData) => {
    return apiClient(`/events/${id}`, {
      method: 'PUT',
      body: eventData,
    });
  },

  publishEvent: async (id) => {
    return apiClient(`/events/${id}/publish`, {
      method: 'PATCH',
    });
  },

  cancelEvent: async (id) => {
    return apiClient(`/events/${id}/cancel`, {
      method: 'PATCH',
    });
  },

  // Sessions
  listSessions: async (eventId) => {
    return apiClient(`/sessions/event/${eventId}`);
  },

  createSession: async (sessionData) => {
    return apiClient('/sessions', {
      method: 'POST',
      body: sessionData,
    });
  },

  updateSession: async (id, sessionData) => {
    return apiClient(`/sessions/${id}`, {
      method: 'PUT',
      body: sessionData,
    });
  },

  deleteSession: async (id) => {
    return apiClient(`/sessions/${id}`, {
      method: 'DELETE',
    });
  },

  // Speakers
  listSpeakers: async (eventId) => {
    return apiClient(`/speakers/event/${eventId}`);
  },

  createSpeaker: async (speakerData) => {
    return apiClient('/speakers', {
      method: 'POST',
      body: speakerData,
    });
  },

  // Venues
  listVenues: async () => {
    return apiClient('/venues');
  },

  createVenue: async (venueData) => {
    return apiClient('/venues', {
      method: 'POST',
      body: venueData,
    });
  },
};

export default eventsApi;
