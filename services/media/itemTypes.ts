import { BaseItemKind, PersonKind } from '@jellyfin/sdk/lib/generated-client/models';

import type { MediaItemType, MediaPersonType } from './types';

const knownMediaItemTypes = new Set<string>(Object.values(BaseItemKind));
const knownPersonTypes = new Set<string>(Object.values(PersonKind));

export function normalizeMediaItemType(type: string | null | undefined): MediaItemType {
  return type && knownMediaItemTypes.has(type) ? (type as MediaItemType) : 'Other';
}

export function normalizeMediaItemTypeList(
  types: MediaItemType[] | null | undefined,
): BaseItemKind[] | undefined {
  if (!types?.length) return undefined;

  const normalized = types
    .map(normalizeMediaItemType)
    .filter((type): type is BaseItemKind => type !== 'Other');

  return normalized.length ? normalized : undefined;
}

export function normalizePersonType(type: string | null | undefined): MediaPersonType {
  return type && knownPersonTypes.has(type) ? (type as MediaPersonType) : 'Other';
}
