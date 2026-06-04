import type { ImageUrlInfo } from '@/lib/utils/image';
import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import type { StreamInfo } from '../jellyfin/stream';
import {
  GetRandomItemsParams,
  MediaAdapter,
  type AuthenticateAndSaveServerParams,
  type CreateApiFromServerInfoParams,
  type CreateApiParams,
  type DiscoverServersParams,
  type FindBestServerParams,
  type GetAllItemsByFolderParams,
  type GetAvailableFiltersParams,
  type GetEpisodesBySeasonParams,
  type GetFavoriteItemsPagedParams,
  type GetFavoriteItemsParams,
  type GetImageInfoParams,
  type GetItemDetailParams,
  type GetItemMediaSourcesParams,
  type GetLatestItemsByFolderParams,
  type GetLatestItemsParams,
  type GetNextUpItemsByFolderParams,
  type GetNextUpItemsParams,
  type GetRecommendedSearchKeywordsParams,
  type GetResumeItemsParams,
  type GetSeasonsBySeriesParams,
  type GetSimilarMoviesParams,
  type GetSimilarShowsParams,
  type GetStreamInfoParams,
  type GetUserInfoParams,
  type GetUserViewParams,
  type LoginParams,
  type MarkItemPlayedParams,
  type MediaFilters,
  type MediaItem,
  type MediaPage,
  type MediaPlaybackInfo,
  type MediaServerInfo,
  type MediaSystemInfo,
  type MediaUser,
  type ReportPlaybackProgressParams,
  type ReportPlaybackStartParams,
  type ReportPlaybackStopParams,
  type SearchItemsParams,
  type UpdateFavoriteItemParams,
} from '../types';
import { createEmbyApiClient } from './client';
import { isBaseItemDto, parseItems, parseItemsWithCount, toRecommendedServerInfo } from './helpers';
import { getEmbyImageInfo } from './image';
import * as embyItems from './items';
import { convertEmbyItemToMediaItem } from './mappers';
import { buildEmbyStreamUrl, mapEmbyPlaybackInfo } from './playback';
import type {
  EmbyApi,
  EmbyAuthenticateResponse,
  EmbyPlaybackInfoResponse,
  EmbyPublicSystemInfo,
  EmbyPublicUser,
} from './types';

export class EmbyAdapter implements MediaAdapter {
  _api: EmbyApi | null = null;

  setApi(api: EmbyApi | null): void {
    this._api = api;
  }

  getApi(): EmbyApi | null {
    return this._api;
  }

  private requireApi(): EmbyApi {
    const api = this.getApi();
    if (!api) throw new Error('API instance not set');
    return api;
  }

  private getClient() {
    return createEmbyApiClient(this.requireApi());
  }

  async discoverServers({ host }: DiscoverServersParams): Promise<RecommendedServerInfo[]> {
    const address = host.replace(/\/$/, '');
    const res = await fetch(`${address}/System/Info/Public`);
    if (!res.ok) return [];
    const data = (await res.json()) as { ServerName?: string };
    return [toRecommendedServerInfo(address, data?.ServerName || address)];
  }

  findBestServer({ servers }: FindBestServerParams): RecommendedServerInfo | null {
    return servers?.[0] ?? null;
  }

  createApi({ address }: CreateApiParams): EmbyApi {
    const basePath = address.replace(/\/$/, '');
    const apiInstance = { basePath, accessToken: null };
    this.setApi(apiInstance);
    return apiInstance;
  }

  createApiFromServerInfo({ serverInfo }: CreateApiFromServerInfoParams): EmbyApi {
    const basePath = serverInfo.address.replace(/\/$/, '');
    const apiInstance = { basePath, accessToken: serverInfo.accessToken };
    this.setApi(apiInstance);
    return apiInstance;
  }

  async getSystemInfo(): Promise<MediaSystemInfo> {
    const res = await this.getClient().get<EmbyPublicSystemInfo>(`/System/Info/Public`);
    const result = res.data;
    return {
      serverName: result?.ServerName,
      version: result?.Version,
      operatingSystem: result?.OperatingSystem,
    };
  }

  async getPublicUsers(): Promise<MediaUser[]> {
    const api = this.requireApi();
    const res = await this.getClient().get<EmbyPublicUser[]>(`/Users/Public`);
    const data = res.data;
    return (data || []).map((user) => ({
      id: user.Id || '',
      name: user.Name || '',
      serverName: user.ServerName,
      avatar: user.PrimaryImageTag
        ? `${api.basePath}/Users/${user.Id}/Images/Primary?quality=90`
        : undefined,
    }));
  }

  async login({ username, password }: LoginParams): Promise<{ data: EmbyAuthenticateResponse }> {
    const client = this.getClient();
    const res = await client.post<EmbyAuthenticateResponse>(
      '/Users/AuthenticateByName',
      { Username: username, Pw: password },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const data = res.data;
    if (data?.AccessToken) this.requireApi().accessToken = data.AccessToken;
    return { data };
  }

  async authenticateAndSaveServer({
    address,
    username,
    password,
    addServer,
  }: AuthenticateAndSaveServerParams): Promise<unknown> {
    this.createApi({ address });
    const loginRes = await this.login({ username, password });
    const token = loginRes?.data?.AccessToken;
    const userId = loginRes?.data?.User?.Id;
    if (userId && token) {
      const normalizedAddress = address.replace(/\/$/, '');
      const sys = await this.getSystemInfo();
      const serverInfo: Omit<MediaServerInfo, 'id' | 'createdAt'> = {
        address: normalizedAddress,
        name: sys.serverName || normalizedAddress,
        userId: userId,
        username: loginRes.data?.User?.Name || username,
        userAvatar: `${normalizedAddress}/Users/${userId}/Images/Primary?quality=90`,
        accessToken: token,
        type: 'emby',
      };
      await addServer(serverInfo);
      return loginRes;
    }
    throw new Error('Authentication failed');
  }

  async getLatestItems({
    userId,
    limit,
    includeItemTypes,
    sortBy,
    sortOrder,
    year,
    tags,
  }: GetLatestItemsParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getLatestItems(this.getClient(), {
      userId,
      limit,
      includeItemTypes,
      sortBy,
      sortOrder,
      year,
      tags,
    });
    return await parseItemsWithCount(res);
  }

  async getLatestItemsByFolder({
    userId,
    folderId,
    limit,
  }: GetLatestItemsByFolderParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getLatestItemsByFolder(this.getClient(), {
      userId,
      folderId,
      limit,
    });
    const items = await parseItems({ Items: res.data });
    return { items };
  }

  async getNextUpItems({ userId, limit }: GetNextUpItemsParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getNextUpItems(this.getClient(), { userId, limit });
    return await parseItemsWithCount(res);
  }

  async getNextUpItemsByFolder({
    userId,
    folderId,
    limit,
  }: GetNextUpItemsByFolderParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getNextUpItemsByFolder(this.getClient(), {
      userId,
      folderId,
      limit,
    });
    return await parseItemsWithCount(res);
  }

  async getResumeItems({ userId, limit }: GetResumeItemsParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getResumeItems(this.getClient(), { userId, limit });
    return await parseItemsWithCount(res);
  }

  async getFavoriteItems({ userId, limit }: GetFavoriteItemsParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getFavoriteItems(this.getClient(), { userId, limit });
    const items = await parseItems(res);
    return { items };
  }

  async getFavoriteItemsPaged({
    userId,
    startIndex,
    limit,
    includeItemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetFavoriteItemsPagedParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getFavoriteItemsPaged(this.getClient(), {
      userId,
      startIndex,
      limit,
      includeItemTypes,
      sortBy,
      sortOrder,
      onlyUnplayed,
      year,
      tags,
    });
    return await parseItemsWithCount(res);
  }

  async logout(): Promise<void> {
    this.requireApi().accessToken = null;
  }

  async getUserInfo({ userId }: GetUserInfoParams): Promise<MediaUser> {
    const api = this.requireApi();
    const res = await this.getClient().get<EmbyPublicUser>(`/Users/${userId}`);
    const result = res.data;
    return {
      id: result?.Id || '',
      name: result?.Name || '',
      serverName: result?.ServerName,
      avatar: result?.PrimaryImageTag
        ? `${api.basePath}/Users/${userId}/Images/Primary?quality=90`
        : undefined,
    };
  }

  async getItemDetail({ itemId, userId }: GetItemDetailParams): Promise<MediaItem> {
    const res = await this.getClient().get<BaseItemDto>(`/Users/${userId}/Items/${itemId}`);
    const data = res.data;
    return convertEmbyItemToMediaItem(data);
  }

  async getItemMediaSources({ itemId }: GetItemMediaSourcesParams): Promise<MediaPlaybackInfo> {
    const res = await this.getClient().post<EmbyPlaybackInfoResponse>(
      `/Items/${itemId}/PlaybackInfo`,
      {
        IsPlayback: true,
        AutoOpenLiveStream: true,
      },
    );
    return mapEmbyPlaybackInfo(res.data);
  }

  async getUserView({ userId }: GetUserViewParams): Promise<MediaItem[]> {
    const res = await embyItems.getUserView(this.getClient(), { userId });
    return await parseItems(res);
  }

  async getAllItemsByFolder({
    userId,
    folderId,
    startIndex,
    limit,
    itemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetAllItemsByFolderParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getAllItemsByFolder(this.getClient(), {
      userId,
      folderId,
      startIndex,
      limit,
      itemTypes,
      sortBy,
      sortOrder,
      onlyUnplayed,
      year,
      tags,
    });
    return await parseItemsWithCount(res);
  }

  async getSeasonsBySeries({
    seriesId,
    userId,
  }: GetSeasonsBySeriesParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getSeasonsBySeries(this.getClient(), {
      seriesId,
      userId,
    });
    const items = await parseItems(res);
    return { items };
  }

  async getEpisodesBySeason({
    seasonId,
    userId,
  }: GetEpisodesBySeasonParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getEpisodesBySeason(this.getClient(), {
      seasonId,
      userId,
    });
    const items = await parseItems(res);
    return { items };
  }

  async getSimilarShows({
    itemId,
    userId,
    limit,
  }: GetSimilarShowsParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getSimilarShows(this.getClient(), {
      itemId,
      userId,
      limit,
    });
    const items = await parseItems(res);
    return { items };
  }

  async getSimilarMovies({
    itemId,
    userId,
    limit,
  }: GetSimilarMoviesParams): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getSimilarMovies(this.getClient(), {
      itemId,
      userId,
      limit,
    });
    const items = await parseItems(res);
    return { items };
  }

  async searchItems({
    userId,
    searchTerm,
    limit,
    includeItemTypes,
  }: SearchItemsParams): Promise<MediaItem[]> {
    const res = await embyItems.searchItems(this.getClient(), {
      userId,
      searchTerm,
      limit,
      includeItemTypes,
    });
    return await parseItems(res);
  }

  async getRecommendedSearchKeywords({
    userId,
    limit,
  }: GetRecommendedSearchKeywordsParams): Promise<string[]> {
    const res = await embyItems.getRecommendedSearchKeywords(this.getClient(), {
      userId,
      limit,
    });
    const data = res.data;
    const titles = (data.Items ?? []).map((i) => i.Name).filter((v): v is string => Boolean(v));
    return Array.from(new Set(titles)).slice(0, limit ?? 20);
  }

  async getRandomItems({ userId, limit }: GetRandomItemsParams): Promise<MediaItem[]> {
    const res = await embyItems.getRandomItems(this.getClient(), { userId, limit });
    return await parseItems(res);
  }

  async getAvailableFilters({
    userId,
    parentId,
  }: GetAvailableFiltersParams): Promise<MediaFilters> {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    return {
      years,
      tags: [],
      genres: [],
    };
  }

  getImageInfo({ item, opts }: GetImageInfoParams): ImageUrlInfo {
    const api = this.requireApi();
    return getEmbyImageInfo({ api, item, opts });
  }

  async getStreamInfo({
    item,
    userId,
    startTimeTicks,
    maxStreamingBitrate,
    playSessionId,
    deviceProfile,
    audioStreamIndex,
    subtitleStreamIndex,
    height,
    mediaSourceId,
    deviceId,
  }: GetStreamInfoParams): Promise<StreamInfo | null> {
    const api = this.requireApi();
    const rawCandidate = (item as MediaItem | null | undefined)?.raw ?? null;
    const baseItem = isBaseItemDto(rawCandidate) ? rawCandidate : null;
    if (!userId || !baseItem?.Id) return null;

    const res = await this.getClient().post(`/Items/${baseItem.Id}/PlaybackInfo`, {
      UserId: userId,
      DeviceProfile: deviceProfile,
      SubtitleStreamIndex: subtitleStreamIndex,
      StartTimeTicks: startTimeTicks,
      IsPlayback: true,
      AutoOpenLiveStream: true,
      MaxStreamingBitrate: maxStreamingBitrate,
      AudioStreamIndex: audioStreamIndex,
      MediaSourceId: mediaSourceId,
    });
    const playback = res.data as {
      PlaySessionId?: string;
      MediaSources?: { Id?: string; TranscodingUrl?: string }[];
    };
    const mediaSource = playback.MediaSources?.[0];
    const sessionId = playback.PlaySessionId || null;

    const url = buildEmbyStreamUrl({
      api,
      itemId: baseItem.Id,
      mediaSource,
      userId,
      startTimeTicks,
      maxStreamingBitrate,
      playSessionId,
      audioStreamIndex,
      subtitleStreamIndex,
      deviceId,
    });

    return { url, sessionId, mediaSource: undefined };
  }

  async addFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await this.getClient().post(`/Users/${userId}/FavoriteItems/${itemId}`);
  }

  async removeFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await this.getClient().delete(`/Users/${userId}/FavoriteItems/${itemId}`);
  }

  async markItemPlayed({ userId, itemId, datePlayed }: MarkItemPlayedParams): Promise<void> {
    const qs = new URLSearchParams();
    if (datePlayed) qs.set('DatePlayed', datePlayed);
    await this.getClient().post(`/Users/${userId}/PlayedItems/${itemId}?${qs.toString()}`);
  }

  async markItemUnplayed({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await this.getClient().delete(`/Users/${userId}/PlayedItems/${itemId}`);
  }

  async reportPlaybackProgress({
    itemId,
    positionTicks,
    isPaused,
    PlaySessionId,
  }: ReportPlaybackProgressParams): Promise<void> {
    await this.getClient().post(`/emby/Sessions/Playing/Progress`, {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      IsPaused: isPaused ?? false,
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    });
  }

  async reportPlaybackStart({
    itemId,
    positionTicks,
    PlaySessionId,
  }: ReportPlaybackStartParams): Promise<void> {
    await this.getClient().post(`/emby/Sessions/Playing`, {
      ItemId: itemId,
      PositionTicks: Math.floor((positionTicks ?? 0) * 10000),
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    });
  }

  async reportPlaybackStop({
    itemId,
    positionTicks,
    PlaySessionId,
  }: ReportPlaybackStopParams): Promise<void> {
    await this.getClient().post(`/emby/Sessions/Playing/Stopped`, {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      PlaySessionId,
    });
  }
}

export const embyAdapter = new EmbyAdapter();
