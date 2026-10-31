import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { sanitizeNetworkUrl } from './performanceMetrics';

type Trace = { end: (status: 'ok' | 'error', detail?: string) => void };

export function captureAxiosDiagnostics(client: AxiosInstance, begin: (name: string) => Trace) {
  const traces = new WeakMap<InternalAxiosRequestConfig, Trace>();
  const requestId = client.interceptors.request.use((config) => {
    traces.set(
      config,
      begin(
        `${config.method?.toUpperCase() ?? 'GET'} ${sanitizeNetworkUrl(client.getUri(config))}`,
      ),
    );
    return config;
  });
  const responseId = client.interceptors.response.use(
    (response) => {
      traces.get(response.config)?.end('ok', `HTTP ${response.status}`);
      traces.delete(response.config);
      return response;
    },
    (error) => {
      if (error.config) {
        traces
          .get(error.config)
          ?.end(
            'error',
            `${error.code ?? 'request failed'}: ${error.message}${error.response ? ` (HTTP ${error.response.status})` : ''}`,
          );
        traces.delete(error.config);
      }
      return Promise.reject(error);
    },
  );
  return () => {
    client.interceptors.request.eject(requestId);
    client.interceptors.response.eject(responseId);
  };
}
