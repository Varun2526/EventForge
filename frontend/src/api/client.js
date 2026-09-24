/**
 * EventForge HTTP Client
 * Handles authorization tokens, uniform response unwrapping, and standardized error parsing.
 */
// In development, Vite proxies this relative path. Vercel builds use the
// Render service URL configured as VITE_API_BASE_URL (including /api/v1).
const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api/v1';

export async function apiClient(endpoint, { method = 'GET', body, headers = {}, ...customConfig } = {}) {
  const token = localStorage.getItem('ef_token');

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...customConfig,
  };

  if (body) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${BASE_URL}${cleanEndpoint}`, config);

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const errorCode = data?.error?.code || 'REQUEST_FAILED';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = errorCode;
    error.data = data;
    throw error;
  }

  // EventForge standard response envelope: { success: true, data: { ... } }
  return data?.data !== undefined ? data.data : data;
}

export default apiClient;
