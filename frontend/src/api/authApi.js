import apiClient from './client';

export const authApi = {
  login: async (credentials) => {
    return apiClient('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  },

  register: async (userData) => {
    return apiClient('/auth/register', {
      method: 'POST',
      body: userData,
    });
  },

  getMe: async () => {
    return apiClient('/auth/me', {
      method: 'GET',
    });
  },
};

export default authApi;
