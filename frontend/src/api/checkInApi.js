import apiClient from './client';

export const checkInApi = {
  gateCheckIn: async ({ token, deviceId = 'web-gate-terminal-01' }) => {
    return apiClient('/checkin/event', {
      method: 'POST',
      body: { token, deviceId },
    });
  },

  sessionCheckIn: async ({ token, sessionId, deviceId = 'web-room-terminal-01' }) => {
    return apiClient('/checkin/session', {
      method: 'POST',
      body: { token, sessionId, deviceId },
    });
  },
};

export default checkInApi;
