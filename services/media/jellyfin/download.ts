import type { Api } from '@jellyfin/sdk';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api';

export function getJellyfinItemDownloadUrl(api: Api, itemId: string): string | undefined {
  const serverAddress = api.basePath;
  const userToken = api.accessToken;

  if (!serverAddress || !userToken) {
    return undefined;
  }

  return `${serverAddress}/Items/${itemId}/Download?api_key=${userToken}`;
}

export async function getJellyfinSeasonDownloadMap(
  api: Api,
  seasonId: string,
  userId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const response = await getItemsApi(api).getItems({
    userId,
    parentId: seasonId,
    fields: [ItemFields.Overview, ItemFields.CanDownload, ItemFields.Path],
  });

  for (const episode of response.data?.Items ?? []) {
    if (episode.Id && episode.Name) {
      const url = getJellyfinItemDownloadUrl(api, episode.Id);

      if (url) {
        result.set(episode.Name, url);
      }
    }
  }

  return result;
}

export async function getJellyfinSeriesDownloadMap(
  api: Api,
  seriesId: string,
  userId: string,
): Promise<Map<string, string>> {
  let result = new Map<string, string>();
  const response = await getTvShowsApi(api).getSeasons({
    userId,
    seriesId,
  });

  for (const season of response.data?.Items ?? []) {
    if (season.Id) {
      const map = await getJellyfinSeasonDownloadMap(api, season.Id, userId);
      result = new Map([...result, ...map]);
    }
  }

  return result;
}
