import type { MediaServerType } from '@/services/media/types';

export const MEDIA_SERVER_TYPES = {
  jellyfin: { label: 'Jellyfin' },
  emby: { label: 'Emby' },
} as const satisfies Record<MediaServerType, { label: string }>;

export const MEDIA_SERVER_TYPE_OPTIONS = Object.entries(MEDIA_SERVER_TYPES).map(
  ([type, details]) => ({ type: type as MediaServerType, ...details }),
);

export function isMediaServerType(value: string | undefined): value is MediaServerType {
  return value !== undefined && Object.hasOwn(MEDIA_SERVER_TYPES, value);
}
