import { apiClient } from '../../lib/api-client';
import type { CurrentUser } from '../../types/api';

export type LoginBody = {
  email: string;
  password: string;
};

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  companyName: string;
};

export async function login(body: LoginBody) {
  return apiClient.post<CurrentUser & { csrfToken: string }>('/api/auth/login', body);
}

export async function register(body: RegisterBody) {
  return apiClient.post<CurrentUser & { csrfToken: string; emailVerificationToken?: string }>('/api/auth/register', body);
}

export async function logout(csrfToken: string | null) {
  return apiClient.post<void>('/api/auth/logout', {}, { csrfToken });
}

export async function fetchCsrfToken() {
  const response = await apiClient.get<{ csrfToken: string }>('/api/auth/csrf');
  return response.csrfToken;
}
