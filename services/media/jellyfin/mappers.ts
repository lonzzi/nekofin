import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import { mapRawItemToMediaItem } from '../mappers';
import type { MediaItem, MediaPage } from '../types';

type JellyfinItemsPayload = {
  Items?: BaseItemDto[] | null;
  TotalRecordCount?: number | null;
};

type JellyfinResponse<T> = {
  data?: T | null;
};

export function parseJellyfinItems(payload?: JellyfinItemsPayload | null): MediaItem[] {
  return payload?.Items?.map(mapRawItemToMediaItem) ?? [];
}

export function parseJellyfinItemsResponse(
  response: JellyfinResponse<JellyfinItemsPayload>,
): MediaItem[] {
  return parseJellyfinItems(response.data);
}

export function parseJellyfinItemsPage(
  response: JellyfinResponse<JellyfinItemsPayload>,
): MediaPage<MediaItem> {
  return {
    items: parseJellyfinItems(response.data),
    total: response.data?.TotalRecordCount ?? undefined,
  };
}

export function parseJellyfinItemArrayResponse(
  response: JellyfinResponse<BaseItemDto[]>,
): MediaPage<MediaItem> {
  return {
    items: response.data?.map(mapRawItemToMediaItem) ?? [],
  };
}
