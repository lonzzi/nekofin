import { Api } from '@jellyfin/sdk';
import {
  getMediaInfoApi,
  getPlaystateApi,
  getSystemApi,
  getUserApi,
  getUserLibraryApi,
} from '@jellyfin/sdk/lib/utils/api';

export * from './client';
export * from './items';
export * from './stream';

export async function getSystemInfo(api: Api) {
  return await getSystemApi(api).getPublicSystemInfo();
}

export async function getPublicUsers(api: Api) {
  return await getUserApi(api).getPublicUsers();
}

export async function logout(api: Api) {
  return await api.logout();
}

export async function getUserInfo(api: Api, userId: string) {
  return await getUserApi(api).getUserById({ userId });
}

export async function getItemDetail(api: Api, itemId: string, userId: string) {
  return await getUserLibraryApi(api).getItem({
    itemId,
    userId,
  });
}

export async function getItemMediaSources(api: Api, itemId: string) {
  return await getMediaInfoApi(api).getPlaybackInfo(
    {
      itemId,
    },
    {
      method: 'POST',
      data: {
        isPlayback: true,
        autoOpenLiveStream: true,
      },
    },
  );
}

export async function addFavoriteItem(api: Api, userId: string, itemId: string) {
  return await getUserLibraryApi(api).markFavoriteItem({ userId, itemId });
}

export async function removeFavoriteItem(api: Api, userId: string, itemId: string) {
  return await getUserLibraryApi(api).unmarkFavoriteItem({ userId, itemId });
}

export async function markItemPlayed(
  api: Api,
  userId: string,
  itemId: string,
  datePlayed?: string,
) {
  return await getPlaystateApi(api).markPlayedItem({ itemId, userId, datePlayed });
}

export async function markItemUnplayed(api: Api, userId: string, itemId: string) {
  return await getPlaystateApi(api).markUnplayedItem({ itemId, userId });
}

export async function reportPlaybackProgress(
  api: Api,
  itemId: string,
  positionTicks: number,
  isPaused: boolean = false,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackProgress({
    playbackProgressInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      IsPaused: isPaused,
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    },
  });
}

export async function reportPlaybackStart(
  api: Api,
  itemId: string,
  positionTicks: number = 0,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackStart({
    playbackStartInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    },
  });
}

export async function reportPlaybackStop(
  api: Api,
  itemId: string,
  positionTicks: number,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackStopped({
    playbackStopInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      PlaySessionId,
    },
  });
}
