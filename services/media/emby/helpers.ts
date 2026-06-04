import type { ApiResponse } from '@/lib/request';
import { BaseItemDto, ItemSortBy } from '@jellyfin/sdk/lib/generated-client';
import { RecommendedServerInfo } from '@jellyfin/sdk/lib/models/recommended-server-info';

import { MediaItem, MediaPage, MediaPerson, MediaSortBy } from '../types';
import { convertEmbyItemToMediaItem } from './mappers';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isBaseItemDto(value: unknown): value is BaseItemDto {
  return isRecord(value) && 'Id' in value;
}

export function toRecommendedServerInfo(address: string, name: string): RecommendedServerInfo {
  return { Address: address, Id: 'emby', Name: name } as unknown as RecommendedServerInfo;
}

export function getUnderlyingRaw(item: MediaItem | MediaPerson): unknown {
  return 'raw' in (item as MediaItem) ? ((item as MediaItem).raw ?? item) : item;
}

export function getBlurHash(itemData: BaseItemDto, imageType: string): string | undefined {
  const hashes = itemData.ImageBlurHashes;
  if (!hashes) return undefined;
  const value = hashes[imageType as keyof typeof hashes];
  return typeof value === 'string' ? value : undefined;
}

export function setIfDefined(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === undefined || value === null) return;
  params.set(key, String(value));
}

export function setListIfNotEmpty(
  params: URLSearchParams,
  key: string,
  arr: (string | number)[] | undefined,
) {
  if (!arr || arr.length === 0) return;
  params.set(key, arr.join(','));
}

export function applyDefaultImageAndFields(params: URLSearchParams, fields?: string) {
  params.set(
    'Fields',
    fields || 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path',
  );
  params.set('ImageTypeLimit', '1');
  params.set('EnableImageTypes', 'Primary,Backdrop,Thumb');
}

export async function parseItems(
  res: ApiResponse<{ Items?: BaseItemDto[] }> | { Items?: BaseItemDto[] },
): Promise<MediaItem[]> {
  const payload =
    'code' in (res as ApiResponse<unknown>)
      ? (res as ApiResponse<{ Items?: BaseItemDto[] }>).data
      : (res as { Items?: BaseItemDto[] });
  return payload.Items?.map(convertEmbyItemToMediaItem) || [];
}

export async function parseItemsWithCount(
  res:
    | ApiResponse<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>
    | { Items?: BaseItemDto[]; TotalRecordCount?: number },
): Promise<MediaPage<MediaItem>> {
  const payload =
    'code' in (res as ApiResponse<unknown>)
      ? (res as ApiResponse<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>).data
      : (res as { Items?: BaseItemDto[]; TotalRecordCount?: number });
  return {
    items: payload.Items?.map(convertEmbyItemToMediaItem) ?? [],
    total: payload.TotalRecordCount,
  };
}

export function convertSortByToEmby(sortBy: MediaSortBy[]): ItemSortBy[] {
  return sortBy.map((sb) => sb as ItemSortBy);
}
