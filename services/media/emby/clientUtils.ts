import type { ApiResponse } from '@/lib/request';

import type { EmbyApi } from './types';

export function createEmbyHeaders(
  api: EmbyApi,
  deviceId: string,
  headers?: HeadersInit,
): Record<string, string> {
  const nextHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Emby-Client': 'Nekofin',
    'X-Emby-Device-Name': 'Nekofin Device',
    'X-Emby-Device-Id': deviceId,
    'X-Emby-Client-Version': '1.0.0',
    'X-Emby-Language': 'zh-cn',
    ...(headers as Record<string, string> | undefined),
  };

  if (api.accessToken) nextHeaders['X-Emby-Token'] = api.accessToken;

  return nextHeaders;
}

export async function wrapEmbyResponse(response: Response) {
  if (!response.ok) return response;

  const text = await response.text();
  if (!text.trim()) {
    return { code: 200, data: null, msg: 'ok' } satisfies ApiResponse<unknown>;
  }

  try {
    return {
      code: 200,
      data: JSON.parse(text) as unknown,
      msg: 'ok',
    } satisfies ApiResponse<unknown>;
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return { code: 200, data: null, msg: 'ok' } satisfies ApiResponse<unknown>;
  }
}
