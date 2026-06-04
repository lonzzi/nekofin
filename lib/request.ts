type RequestInterceptor = (config: RequestInit) => RequestInit;
type ResponseInterceptor = (
  response: Response,
) => Response | Promise<Response | ApiResponse<unknown>>;

interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  code?: number;
  status?: number;
  url: string;

  constructor(
    message: string,
    { code, status, url }: { code?: number; status?: number; url: string },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.url = url;
  }
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export interface ApiClient {
  request: <T>(url: string, config?: RequestInit) => Promise<ApiResponse<T>>;
  get: <T>(
    url: string,
    params?: Record<string, unknown>,
    config?: RequestInit,
  ) => Promise<ApiResponse<T>>;
  post: <T>(url: string, data?: unknown, config?: RequestInit) => Promise<ApiResponse<T>>;
  delete: <T>(url: string, config?: RequestInit) => Promise<ApiResponse<T>>;
  put: <T>(url: string, data?: unknown, config?: RequestInit) => Promise<ApiResponse<T>>;
  addRequestInterceptor: (interceptor: RequestInterceptor) => void;
  addResponseInterceptor: (interceptor: ResponseInterceptor) => void;
}

function createApiClient({ baseUrl, timeoutMs }: ApiClientOptions): ApiClient {
  const requestInterceptors: RequestInterceptor[] = [];
  const responseInterceptors: ResponseInterceptor[] = [];

  const request = async <T>(url: string, config: RequestInit = {}): Promise<ApiResponse<T>> => {
    const fullUrl = `${baseUrl}${url}`;

    let interceptedConfig = { ...config };
    for (const interceptor of requestInterceptors) {
      interceptedConfig = interceptor(interceptedConfig);
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && !interceptedConfig.signal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      interceptedConfig = { ...interceptedConfig, signal: controller.signal };
    }

    let response: Response;
    try {
      response = await fetch(fullUrl, interceptedConfig);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    for (const interceptor of responseInterceptors) {
      const interceptedResponse = await interceptor(response);
      if ('code' in interceptedResponse) {
        return interceptedResponse as ApiResponse<T>;
      }
      response = interceptedResponse as Response;
    }

    if (!response.ok) {
      throw new ApiClientError(`HTTP error! status: ${response.status}`, {
        status: response.status,
        url: fullUrl,
      });
    }

    const apiResponse: ApiResponse<T> = await response.json();
    if (apiResponse.code !== 0 && apiResponse.code !== 200) {
      throw new ApiClientError(
        `API error! code: ${apiResponse.code}, message: ${apiResponse.msg}`,
        {
          code: apiResponse.code,
          url: fullUrl,
        },
      );
    }

    return apiResponse;
  };

  const get = <T>(url: string, params?: Record<string, unknown>, config?: RequestInit) => {
    let fullUrl = url;
    if (
      params &&
      typeof params === 'object' &&
      !Array.isArray(params) &&
      params !== null &&
      Object.keys(params).length > 0
    ) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v != null ? String(v) : ''));
        } else {
          searchParams.append(key, String(value));
        }
      });
      fullUrl += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }
    return request<T>(fullUrl, { ...config, method: 'GET' });
  };

  const post = <T>(url: string, data?: unknown, config?: RequestInit) =>
    request<T>(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
    });

  const deleteFn = <T>(url: string, config?: RequestInit) =>
    request<T>(url, { ...config, method: 'DELETE' });

  const put = <T>(url: string, data?: unknown, config?: RequestInit) =>
    request<T>(url, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
    });

  const addRequestInterceptor = (interceptor: RequestInterceptor) => {
    requestInterceptors.push(interceptor);
  };

  const addResponseInterceptor = (interceptor: ResponseInterceptor) => {
    responseInterceptors.push(interceptor);
  };

  return {
    request,
    get,
    post,
    delete: deleteFn,
    put,
    addRequestInterceptor,
    addResponseInterceptor,
  };
}

export default createApiClient;
