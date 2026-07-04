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
  EmbyHomeSection,
  EmbyPlaybackInfoResponse,
  EmbyPrefix,
  EmbyPublicSystemInfo,
  EmbyPublicUser,
} from './types';

export class EmbyAdapter extends MediaAdapter {
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
    // Try /emby/ prefix first (standard Emby server path), then fall back to root
    for (const basePath of [`${address}/emby`, address]) {
      try {
        const res = await fetch(`${basePath}/System/Info/Public`);
        if (!res.ok) continue;
        const data = (await res.json()) as { ServerName?: string };
        if (data?.ServerName) {
          return [toRecommendedServerInfo(basePath, data.ServerName)];
        }
      } catch {
        continue;
      }
    }
    return [];
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
    const body = new URLSearchParams({ Username: username, Pw: password }).toString();
    const res = await client.request<EmbyAuthenticateResponse>('/Users/AuthenticateByName', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
    });
    const data = res.data;
    if (data?.AccessToken) this.requireApi().accessToken = data.AccessToken;
    return { data };
  }

  /**
   * Detect whether the Emby server uses /emby/ prefix by probing System/Info/Public.
   * Returns the correct basePath for API calls.
   */
  private async detectEmbyBasePath(address: string): Promise<string> {
    const normalized = address.replace(/\/$/, '');
    // If address already ends with /emby, use as-is
    if (normalized.toLowerCase().endsWith('/emby')) return normalized;
    // Try /emby/ prefix first (standard Emby path), then fall back to root
    for (const candidate of [`${normalized}/emby`, normalized]) {
      try {
        const res = await fetch(`${candidate}/System/Info/Public`);
        if (res.ok) {
          const data = (await res.json()) as { ServerName?: string };
          if (data?.ServerName) return candidate;
        }
      } catch {
        continue;
      }
    }
    return normalized;
  }

  async authenticateAndSaveServer({
    address,
    username,
    password,
    name,
    note,
    addServer,
  }: AuthenticateAndSaveServerParams): Promise<unknown> {
    // Auto-detect /emby/ prefix before creating API
    const basePath = await this.detectEmbyBasePath(address);
    this.createApi({ address: basePath });
    const loginRes = await this.login({ username, password });
    const token = loginRes?.data?.AccessToken;
    const userId = loginRes?.data?.User?.Id;
    if (userId && token) {
      const sys = await this.getSystemInfo();
      const serverInfo: Omit<MediaServerInfo, 'id' | 'createdAt'> = {
        address: basePath,
        name: name?.trim() || sys.serverName || basePath,
        note: note?.trim() || undefined,
        userId: userId,
        username: loginRes.data?.User?.Name || username,
        userAvatar: `${basePath}/Users/${userId}/Images/Primary?quality=90`,
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
    // Emby does not have a dedicated /Items/Filters endpoint (that's Jellyfin).
    // We fetch genres and tags from their respective endpoints, and generate years.
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 15 }, (_, i) => currentYear - i);

    const [genresRes, tagsRes] = await Promise.all([
      embyItems
        .getGenres(this.getClient(), { userId, parentId })
        .catch(() => ({ data: { Items: [] } })),
      embyItems
        .getTags(this.getClient(), { userId, parentId })
        .catch(() => ({ data: { Items: [] } })),
    ]);

    const genres = (genresRes.data?.Items ?? [])
      .map((i) => i.Name)
      .filter((v): v is string => Boolean(v));
    const tags = (tagsRes.data?.Items ?? [])
      .map((i) => i.Name)
      .filter((v): v is string => Boolean(v));

    return { years, tags, genres };
  }

  // ── Home Sections ─────────────────────────────────────────────

  async getHomeSections(userId: string): Promise<EmbyHomeSection[]> {
    const res = await embyItems.getHomeSections(this.getClient(), userId);
    return res.data ?? [];
  }

  async getSectionItems(
    userId: string,
    sectionId: string,
    limit?: number,
  ): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getSectionItems(this.getClient(), { userId, sectionId, limit });
    return await parseItemsWithCount(res);
  }

  // ── Items Prefixes ────────────────────────────────────────────

  async getItemsPrefixes(
    userId: string,
    parentId?: string,
    includeItemTypes?: string,
  ): Promise<EmbyPrefix[]> {
    const res = await embyItems.getItemsPrefixes(this.getClient(), {
      userId,
      parentId,
      includeItemTypes,
    });
    return res.data ?? [];
  }

  // ── Folder Browsing ───────────────────────────────────────────

  async getFoldersByParent(userId: string, parentId: string): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getFoldersByParent(this.getClient(), { userId, parentId });
    return await parseItemsWithCount(res);
  }

  // ── Box Sets (Collections) ────────────────────────────────────

  async getBoxSets(userId: string, limit?: number): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getBoxSets(this.getClient(), { userId, limit });
    return await parseItemsWithCount(res);
  }

  // ── Playlists ─────────────────────────────────────────────────

  async getPlaylists(userId: string, limit?: number): Promise<MediaPage<MediaItem>> {
    const res = await embyItems.getPlaylists(this.getClient(), { userId, limit });
    return await parseItemsWithCount(res);
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
    await this.getClient().post(`/Sessions/Playing/Progress`, {
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
    await this.getClient().post(`/Sessions/Playing`, {
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
    await this.getClient().post(`/Sessions/Playing/Stopped`, {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      PlaySessionId,
    });
  }
}

export const embyAdapter = new EmbyAdapter();
