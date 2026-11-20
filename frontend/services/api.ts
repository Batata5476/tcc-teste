import { getToken, handleSessionExpired } from './auth';

import { API_URL } from './config';

export async function authenticatedFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(API_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await handleSessionExpired();
  }

  return response;
}
