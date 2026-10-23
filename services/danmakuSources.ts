import { t as tr } from '@/lib/i18n';

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
  get name() {
    return tr('danmaku.defaultApi');
  },
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
    throw new Error(tr('danmaku.enterFullApiUrl'));
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(tr('danmaku.apiUrlProtocolRequired'));
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
              : tr('danmaku.customApi'),
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
    {
      id: DEFAULT_DANMAKU_SOURCE.id,
      get name() {
        return DEFAULT_DANMAKU_SOURCE.name;
      },
      baseUrl: DEFAULT_DANMAKU_SOURCE.baseUrl,
      enabled: settings.defaultEnabled,
    },
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
      // The built-in display name is localized; it must not invalidate comment caches.
      const name = source.id === DEFAULT_DANMAKU_SOURCE_ID ? '' : source.name;
      return source.id + ':' + name + ':' + (hash >>> 0).toString(36);
    })
    .sort()
    .join('|');
}
