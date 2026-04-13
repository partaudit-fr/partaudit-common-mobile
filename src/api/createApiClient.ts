import { parseErrorMessage } from '../errors/parseErrorMessage';

// OpenTelemetry is optional — tracing is a no-op if not installed
let otel: {
  context: any;
  trace: any;
  propagation: any;
  SpanStatusCode: any;
  SpanKind: any;
} | null = null;

try {
  otel = require('@opentelemetry/api');
} catch {
  // OTEL not available — tracing disabled
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export interface ApiClientConfig {
  /** Base URL for the main API (e.g. https://api.devpartaudit.fr/app/partaudit) */
  baseUrl: string;
  /** Returns the current access token, refreshing if needed */
  getAccessToken: () => Promise<string | null>;
  /** Called when the session is expired (401) and cannot be refreshed */
  onSessionExpired: () => void;
  /** Called on API errors to display feedback to the user */
  onError: (error: unknown) => void;
  /** Optional tracer name for OpenTelemetry spans */
  tracerName?: string;
  /** Optional additional base URLs for other services */
  serviceUrls?: {
    notifications?: string;
    search?: string;
    chats?: string;
  };
}

export interface ApiClient {
  get: <T = unknown>(url: string) => Promise<T>;
  post: <T = unknown>(url: string, body: unknown) => Promise<T>;
  put: <T = unknown>(url: string, body: unknown) => Promise<T>;
  patch: <T = unknown>(url: string, body: unknown) => Promise<T>;
  del: <T = unknown>(url: string) => Promise<T>;
  putWithoutBody: <T = unknown>(url: string) => Promise<T>;
  postFile: <T = unknown>(url: string, formData: FormData) => Promise<T>;
  putFormData: <T = unknown>(url: string, formData: FormData) => Promise<T>;
  /** GET on the notifications service */
  getNotifications: <T = unknown>(url: string) => Promise<T>;
  /** POST on the search/elastic service */
  postSearch: <T = unknown>(url: string, body: unknown) => Promise<T>;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const {
    baseUrl,
    getAccessToken,
    onSessionExpired,
    onError,
    tracerName = 'partaudit-mobile',
    serviceUrls = {},
  } = config;

  function detectServiceName(url: string): string {
    if (serviceUrls.notifications && url.startsWith(serviceUrls.notifications)) return 'notification-api-v1';
    if (serviceUrls.search && url.startsWith(serviceUrls.search)) return 'search-api-v1';
    if (serviceUrls.chats && url.startsWith(serviceUrls.chats)) return 'chats-api-v1';
    return 'partaudit-api-v1';
  }

  async function tracedFetch(url: string, options: RequestInit): Promise<Response> {
    if (!otel) {
      return fetch(url, options);
    }

    const { context: ctx, trace: tr, propagation: prop, SpanKind: SK, SpanStatusCode: SSC } = otel;
    const tracer = tr.getTracer(tracerName);
    const serviceName = detectServiceName(url);

    const span = tracer.startSpan(`HTTP ${options.method || 'GET'} ${url}`, {
      kind: SK.CLIENT,
      attributes: {
        'http.url': url,
        'http.method': options.method,
        'target.service': serviceName,
      },
    });

    return ctx.with(tr.setSpan(ctx.active(), span), async () => {
      try {
        const carrier: Record<string, string> = {};
        prop.inject(ctx.active(), carrier);

        const headersWithTrace = {
          ...(options.headers as Record<string, string>),
          ...carrier,
        };

        const response = await fetch(url, {
          ...options,
          headers: headersWithTrace,
        });

        span.setAttribute('http.status_code', response.status);
        return response;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SSC.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async function getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async function getHeadersNoContentType(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async function handleResponse<T>(response: Response): Promise<T> {
    let data;
    try {
      if (response.status !== 204) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return Promise.reject({
            error: true,
            message: 'Service unavailable',
            status: response.status,
          });
        }
        data = await response.json();
      }
    } catch {
      return Promise.reject({
        error: true,
        message: 'Failed to parse response. Please try again later.',
      });
    }

    if (!response.ok) {
      if (response.status === 401) {
        onSessionExpired();
        return Promise.reject({
          error: true,
          code: data?.code || 'SESSION_EXPIRED',
          message: data?.message || 'Votre session a expiré. Veuillez vous reconnecter.',
          status: 401,
          isSessionExpired: true,
        });
      }

      return Promise.reject({
        error: true,
        code: data?.code || 'INTERNAL_ERROR',
        message: data?.message || 'Une erreur est survenue.',
        status: response.status,
        details: data?.details,
      });
    }

    return data as T;
  }

  async function request<T>(method: string, fullUrl: string, body?: unknown, isFormData = false): Promise<T> {
    const headers = isFormData ? await getHeadersNoContentType() : await getHeaders();

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    try {
      const response = await tracedFetch(fullUrl, options);
      return await handleResponse<T>(response);
    } catch (error) {
      onError(error);
      throw error;
    }
  }

  return {
    get: <T>(url: string) => request<T>('GET', baseUrl + url),
    post: <T>(url: string, body: unknown) => request<T>('POST', baseUrl + url, body),
    put: <T>(url: string, body: unknown) => request<T>('PUT', baseUrl + url, body),
    patch: <T>(url: string, body: unknown) => request<T>('PATCH', baseUrl + url, body),
    del: <T>(url: string) => request<T>('DELETE', baseUrl + url),
    putWithoutBody: <T>(url: string) => request<T>('PUT', baseUrl + url),
    postFile: <T>(url: string, formData: FormData) => request<T>('POST', baseUrl + url, formData, true),
    putFormData: <T>(url: string, formData: FormData) => request<T>('PUT', baseUrl + url, formData, true),

    getNotifications: <T>(url: string) => {
      const notifUrl = serviceUrls.notifications || baseUrl;
      return request<T>('GET', notifUrl + url);
    },

    postSearch: <T>(url: string, body: unknown) => {
      const searchUrl = serviceUrls.search || baseUrl;
      return request<T>('POST', searchUrl + url, body);
    },
  };
}
