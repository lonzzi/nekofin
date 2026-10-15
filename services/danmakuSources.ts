export type DanmakuApiSource = {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
};

export type DanmakuSourceSettings = {
  defaultEnabled: boolean;
  customSources: DanmakuApiSource[];
  mode: 'auto' | 'merge';
};

export const DEFAULT_DANMAKU_SOURCE_ID = 'default';
export const DEFAULT_DANMAKU_SOURCE: DanmakuApiSource = {
  id: DEFAULT_DANMAKU_SOURCE_ID,
  name: '默认 API',
  baseUrl: process.env.EXPO_PUBLIC_DANDANPLAY_API_URL ?? '',
  enabled: true,
};

export const defaultDanmakuSourceSettings: DanmakuSourceSettings = {
  defaultEnabled: true,
  customSources: [],
  mode: 'auto',
};

/** Accept an origin or a complete Dandanplay-compatible API prefix. */
export function normalizeDanmakuApiUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('请输入完整的 API 地址');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error('API 地址需要使用 http 或 https');
  }
  url.hash = '';
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/api\/v\d+(?:\/|$)/i.test(path) ? path : path.replace(/\/api$/i, '') + '/api/v2';
  return url.toString().replace(/\/$/, '');
}

export function danmakuEndpointUrl(baseUrl: string, endpoint: string): URL {
  const url = new URL(normalizeDanmakuApiUrl(baseUrl));
  url.pathname = url.pathname.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
  return url;
}

export function parseDanmakuSourceSettings(saved?: string): DanmakuSourceSettings {
  try {
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultDanmakuSourceSettings;
    }
    const value = parsed as Partial<DanmakuSourceSettings>;
    const ids = new Set([DEFAULT_DANMAKU_SOURCE_ID]);
    const addresses = new Set<string>();
    const customSources: DanmakuApiSource[] = [];
    for (const source of Array.isArray(value.customSources) ? value.customSources : []) {
      if (!source || typeof source.id !== 'string' || !source.id || ids.has(source.id)) continue;
      try {
        const baseUrl = normalizeDanmakuApiUrl(source.baseUrl);
        if (addresses.has(baseUrl)) continue;
        ids.add(source.id);
        addresses.add(baseUrl);
        customSources.push({
          id: source.id,
          name:
            typeof source.name === 'string' && source.name.trim()
              ? source.name.trim()
              : '自定义 API',
          baseUrl,
          enabled: source.enabled !== false,
        });
      } catch {
        // A damaged saved entry must not prevent the remaining sources from loading.
      }
    }
    return {
      defaultEnabled: value.defaultEnabled !== false,
      mode: value.mode === 'merge' ? 'merge' : 'auto',
      customSources,
    };
  } catch {
    return defaultDanmakuSourceSettings;
  }
}

export function getDanmakuSources(settings: DanmakuSourceSettings): DanmakuApiSource[] {
  return [
    { ...DEFAULT_DANMAKU_SOURCE, enabled: settings.defaultEnabled },
    ...settings.customSources,
  ];
}

/** Query keys must change on URL edits without persisting API tokens in the key. */
export function danmakuSourcesKey(sources: DanmakuApiSource[]): string {
  return sources
    .filter((source) => source.enabled)
    .map((source) => {
      let hash = 2166136261;
      for (const char of source.baseUrl) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      }
      return source.id + ':' + source.name + ':' + (hash >>> 0).toString(36);
    })
    .sort()
    .join('|');
}
