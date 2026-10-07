import type { ApiEnvelope, ApiErrorEnvelope } from '../types/api';

type ApiClientOptions = {
  baseUrl: string;
};

type RequestOptions = {
  companyId?: string | null;
  csrfToken?: string | null;
  headers?: Record<string, string>;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: ApiErrorEnvelope['error']['details'],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, body, options);
  }

  async upload<T>(path: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, formData, options);
  }

  async download(path: string, options: RequestOptions = {}): Promise<{ blob: Blob; fileName: string }> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.companyId) headers['x-auditflow-company-id'] = options.companyId;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      const parsed = contentType.includes('application/json') ? await response.json() : undefined;
      const errorBody = parsed as ApiErrorEnvelope | undefined;
      throw new ApiClientError(
        errorBody?.error?.message ?? `API download failed with status ${response.status}`,
        response.status,
        errorBody?.error?.code,
        errorBody?.error?.details,
        errorBody?.error?.requestId,
      );
    }

    const disposition = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await response.blob(),
      fileName: match?.[1] ?? 'auditflow-report.txt',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.companyId) {
      headers['x-auditflow-company-id'] = options.companyId;
    }

    if (options.csrfToken && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      headers['x-csrf-token'] = options.csrfToken;
    }

    const isFormData = body instanceof FormData;
    if (body !== undefined && !isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const parsed = contentType.includes('application/json') ? await response.json() : undefined;

    if (!response.ok) {
      const errorBody = parsed as ApiErrorEnvelope | undefined;
      throw new ApiClientError(
        errorBody?.error?.message ?? `API request failed with status ${response.status}`,
        response.status,
        errorBody?.error?.code,
        errorBody?.error?.details,
        errorBody?.error?.requestId,
      );
    }

    const envelope = parsed as ApiEnvelope<T>;
    return envelope.data;
  }
}

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
});

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4100';
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
