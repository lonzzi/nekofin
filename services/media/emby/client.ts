import createApiClient, { ApiClient } from '@/lib/request';
import { getDeviceId } from '@/lib/utils';

import { createEmbyHeaders, wrapEmbyResponse } from './clientUtils';
import type { EmbyApi } from './types';

export function createEmbyApiClient(api: EmbyApi): ApiClient {
  const client = createApiClient({ baseUrl: api.basePath });
  client.addRequestInterceptor((config) => {
    const headers = createEmbyHeaders(api, getDeviceId(), config.headers);
    return { ...config, headers };
  });
  client.addResponseInterceptor(wrapEmbyResponse);
  return client;
}
