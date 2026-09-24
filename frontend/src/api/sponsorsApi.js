import apiClient from './client';

export const sponsorsApi = {
  getEventSponsors: async (eventId) => {
    return apiClient(`/sponsors/event/${eventId}`);
  },

  createProfile: async (profileData) => {
    return apiClient('/sponsors/profiles', {
      method: 'POST',
      body: profileData,
    });
  },

  createPackage: async (pkgData) => {
    return apiClient('/sponsors/packages', {
      method: 'POST',
      body: pkgData,
    });
  },

  allocatePartnership: async (partnershipData) => {
    return apiClient('/sponsors/partnerships', {
      method: 'POST',
      body: partnershipData,
    });
  },

  updateDeliverable: async (deliverableId, updateData) => {
    return apiClient(`/sponsors/deliverables/${deliverableId}`, {
      method: 'PUT',
      body: updateData,
    });
  },
};

export default sponsorsApi;
