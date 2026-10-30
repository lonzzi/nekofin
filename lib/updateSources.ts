export type UpdateSource = 'github' | 'cnb';
export type UpdateSourcePreference = 'auto' | UpdateSource;

export const UPDATE_SOURCE_KEY = 'appUpdate.source';
export const SELECTED_UPDATE_SOURCE_KEY = 'appUpdate.selectedSource';
export const OTA_SOURCE_PARAMETER = 'nekofin-source';

export const UPDATE_SOURCES = {
  github: {
    name: 'GitHub',
    releases: 'https://github.com/lonzzi/nekofin/releases',
    api: 'https://api.github.com/repos/lonzzi/nekofin/releases',
    accept: 'application/vnd.github+json',
  },
  cnb: {
    name: 'CNB',
    releases: 'https://cnb.cool/lonzzi/nekofin/-/releases',
    api: 'https://cnb.cool/lonzzi/nekofin/-/releases/download/app-sources/updates.json',
    accept: 'application/json',
  },
} as const;

export function isUpdateSource(value: unknown): value is UpdateSource {
  return value === 'github' || value === 'cnb';
}

export function resolveUpdateSource(value: unknown): UpdateSource {
  return isUpdateSource(value) ? value : 'github';
}

export function isUpdateSourcePreference(value: unknown): value is UpdateSourcePreference {
  return value === 'auto' || isUpdateSource(value);
}

export function resolveUpdateSourcePreference(value: unknown): UpdateSourcePreference {
  return isUpdateSourcePreference(value) ? value : 'auto';
}

export function getUpdateDownloadURL(source: UpdateSource, tag: string, name: string) {
  return `${UPDATE_SOURCES[source].releases}/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}
