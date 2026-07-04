import { getImageInfo } from '@/lib/utils/image';
import type { Api } from '@jellyfin/sdk';
import { BaseItemDto, BaseItemKind, ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models';
import { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';

import {
  addFavoriteItem,
  getItemDetail,
  getItemMediaSources,
  getPublicUsers,
  getSystemInfo,
  getUserInfo,
  logout,
  markItemPlayed,
  markItemUnplayed,
  removeFavoriteItem,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStop,
} from '.';
import { normalizeMediaItemTypeList } from '../itemTypes';
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
  type MediaItem,
  type MediaItemType,
  type MediaPage,
  type MediaSortBy,
  type ReportPlaybackProgressParams,
  type ReportPlaybackStartParams,
  type ReportPlaybackStopParams,
  type SearchItemsParams,
  type UpdateFavoriteItemParams,
} from '../types';
import {
  authenticateAndSaveServer,
  createApi,
  createApiFromServerInfo,
  findBestServer,
  getJellyfinInstance,
  login as jfLogin,
} from './client';
import {
  getAllItemsByFolder,
  getAvailableFilters,
  getEpisodesBySeason,
  getFavoriteItems,
  getFavoriteItemsPaged,
  getLatestItems,
  getLatestItemsByFolder,
  getNextUpItems,
  getNextUpItemsByFolder,
  getRandomItems,
  getRecommendedSearchKeywords,
  getResumeItems,
  getSeasonsBySeries,
  getSimilarMovies,
  getSimilarShows,
  getUserView,
  searchItems,
} from './items';
import {
  convertBaseItemDtoToMediaItem,
  parseJellyfinItemArrayResponse,
  parseJellyfinItemsPage,
  parseJellyfinItemsResponse,
} from './mappers';
import { mapJellyfinPlaybackInfo } from './playback';
import { getStreamInfo } from './stream';

export { convertBaseItemDtoToMediaItem } from './mappers';

function convertSortByToJellyfin(sortBy: MediaSortBy[]): ItemSortBy[] {
  return sortBy.map((sb) => sb as ItemSortBy);
}

function convertItemTypesToJellyfin(itemTypes: MediaItemType[]): BaseItemKind[] | undefined {
  return normalizeMediaItemTypeList(itemTypes);
}

export class JellyfinAdapter extends MediaAdapter {
  _api: Api | null = null;

  setApi(api: Api | null): void {
    this._api = api;
  }

  getApi(): Api | null {
    return this._api;
  }

  async discoverServers({ host }: DiscoverServersParams) {
    const jf = getJellyfinInstance();
    return await jf.discovery.getRecommendedServerCandidates(host);
  }

  findBestServer({ servers }: FindBestServerParams) {
    const best = findBestServer(servers);
    return best ?? null;
  }

  createApi({ address }: CreateApiParams) {
    const api = createApi(address);
    this.setApi(api);
    return api;
  }
  createApiFromServerInfo({ serverInfo }: CreateApiFromServerInfoParams): Api {
    const api = createApiFromServerInfo(serverInfo);
    this.setApi(api);
    return api;
  }

  async getSystemInfo() {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getSystemInfo(api);
    return {
      serverName: result.data?.ServerName,
      version: result.data?.Version,
      operatingSystem: result.data?.OperatingSystem,
    };
  }

  async getPublicUsers() {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getPublicUsers(api);
    return (
      result.data?.map((user) => ({
        id: user.Id || '',
        name: user.Name || '',
        serverName: user.ServerName,
        avatar: user.PrimaryImageTag
          ? `${api.basePath}/Users/${user.Id}/Images/Primary?quality=90`
          : undefined,
      })) || []
    );
  }

  login({ username, password }: LoginParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    return jfLogin(api, username, password);
  }

  authenticateAndSaveServer(params: AuthenticateAndSaveServerParams) {
    return authenticateAndSaveServer(
      params.address,
      params.username,
      params.password,
      params.addServer,
      params.name,
      params.note,
    );
  }

  async getLatestItems(params: GetLatestItemsParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getLatestItems(api, params.userId, params.limit, {
      includeItemTypes: params?.includeItemTypes
        ? convertItemTypesToJellyfin(params.includeItemTypes)
        : undefined,
      sortBy: params?.sortBy ? convertSortByToJellyfin(params.sortBy) : undefined,
      sortOrder: params?.sortOrder,
      year: params?.year,
      tags: params?.tags,
    });
    return parseJellyfinItemsPage(result);
  }

  async getLatestItemsByFolder({
    userId,
    folderId,
    limit,
  }: GetLatestItemsByFolderParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getLatestItemsByFolder(api, userId, folderId, limit);
    return parseJellyfinItemArrayResponse(result);
  }

  async getNextUpItems({ userId, limit }: GetNextUpItemsParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getNextUpItems(api, userId, limit);
    return parseJellyfinItemsPage(result);
  }

  async getNextUpItemsByFolder({
    userId,
    folderId,
    limit,
  }: GetNextUpItemsByFolderParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getNextUpItemsByFolder(api, userId, folderId, limit);
    return parseJellyfinItemsPage(result);
  }

  async getResumeItems({ userId, limit }: GetResumeItemsParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getResumeItems(api, userId, limit);
    return parseJellyfinItemsPage(result);
  }

  async getFavoriteItems({ userId, limit }: GetFavoriteItemsParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getFavoriteItems(api, userId, limit);
    return parseJellyfinItemsPage(result);
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
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getFavoriteItemsPaged(api, userId, startIndex, limit, {
      includeItemTypes: includeItemTypes ? convertItemTypesToJellyfin(includeItemTypes) : undefined,
      sortBy: sortBy ? convertSortByToJellyfin(sortBy) : undefined,
      sortOrder,
      onlyUnplayed,
      year,
      tags,
    });
    return parseJellyfinItemsPage(result);
  }

  async logout() {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await logout(api);
  }

  async getUserInfo({ userId }: GetUserInfoParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getUserInfo(api, userId);
    return {
      id: result.data?.Id || '',
      name: result.data?.Name || '',
      serverName: result.data?.ServerName,
      avatar: result.data?.PrimaryImageTag
        ? `${api.basePath}/Users/${userId}/Images/Primary?quality=90`
        : undefined,
    };
  }

  async getItemDetail({ itemId, userId }: GetItemDetailParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getItemDetail(api, itemId, userId);
    return convertBaseItemDtoToMediaItem(result.data!);
  }

  async getItemMediaSources({ itemId }: GetItemMediaSourcesParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getItemMediaSources(api, itemId);
    return mapJellyfinPlaybackInfo(result.data);
  }

  async getUserView({ userId }: GetUserViewParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getUserView(api, userId);
    return parseJellyfinItemsResponse(result);
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
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getAllItemsByFolder(
      api,
      userId,
      folderId,
      startIndex,
      limit,
      itemTypes ? convertItemTypesToJellyfin(itemTypes) : undefined,
      {
        sortBy: sortBy ? convertSortByToJellyfin(sortBy) : undefined,
        sortOrder,
        onlyUnplayed,
        year,
        tags,
      },
    );
    return parseJellyfinItemsPage(result);
  }

  async getSeasonsBySeries({
    seriesId,
    userId,
  }: GetSeasonsBySeriesParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getSeasonsBySeries(api, seriesId, userId);
    return parseJellyfinItemsPage(result);
  }

  async getEpisodesBySeason({
    seasonId,
    userId,
  }: GetEpisodesBySeasonParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getEpisodesBySeason(api, seasonId, userId);
    return parseJellyfinItemsPage(result);
  }

  async getSimilarShows({
    itemId,
    userId,
    limit,
  }: GetSimilarShowsParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getSimilarShows(api, itemId, userId, limit);
    return parseJellyfinItemsPage(result);
  }

  async getSimilarMovies({
    itemId,
    userId,
    limit,
  }: GetSimilarMoviesParams): Promise<MediaPage<MediaItem>> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getSimilarMovies(api, itemId, userId, limit);
    return parseJellyfinItemsPage(result);
  }

  async searchItems({ userId, searchTerm, limit, includeItemTypes }: SearchItemsParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await searchItems(
      api,
      userId,
      searchTerm,
      limit,
      includeItemTypes ? convertItemTypesToJellyfin(includeItemTypes) : undefined,
    );
    return result.map(convertBaseItemDtoToMediaItem);
  }

  async getRecommendedSearchKeywords({ userId, limit }: GetRecommendedSearchKeywordsParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    return getRecommendedSearchKeywords(api, userId, limit);
  }

  async getRandomItems(params: GetRandomItemsParams): Promise<MediaItem[]> {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getRandomItems(api, params.userId, params.limit);
    return result.map(convertBaseItemDtoToMediaItem);
  }

  async getAvailableFilters({ userId, parentId }: GetAvailableFiltersParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    const result = await getAvailableFilters(api, userId, parentId);
    return result;
  }

  getImageInfo({ item, opts }: GetImageInfoParams) {
    const api = this.getApi();
    const baseItem = (item as MediaItem).raw ?? item;
    return getImageInfo(baseItem as BaseItemDto, opts, api);
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
    alwaysBurnInSubtitleWhenTranscoding,
  }: GetStreamInfoParams & { deviceProfile: DeviceProfile }) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    return getStreamInfo({
      api,
      item: (item as MediaItem | null | undefined)?.raw as BaseItemDto,
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
      alwaysBurnInSubtitleWhenTranscoding,
    });
  }

  async addFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await addFavoriteItem(api, userId, itemId);
  }

  async removeFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await removeFavoriteItem(api, userId, itemId);
  }

  async markItemPlayed({ userId, itemId, datePlayed }: MarkItemPlayedParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await markItemPlayed(api, userId, itemId, datePlayed);
  }

  async markItemUnplayed({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await markItemUnplayed(api, userId, itemId);
  }

  async reportPlaybackProgress({
    itemId,
    positionTicks,
    isPaused,
    PlaySessionId,
  }: ReportPlaybackProgressParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackProgress(api, itemId, positionTicks, isPaused ?? false, PlaySessionId);
  }

  async reportPlaybackStart({ itemId, positionTicks, PlaySessionId }: ReportPlaybackStartParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackStart(api, itemId, positionTicks ?? 0, PlaySessionId);
  }

  async reportPlaybackStop({ itemId, positionTicks, PlaySessionId }: ReportPlaybackStopParams) {
    const api = this.getApi();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackStop(api, itemId, positionTicks, PlaySessionId);
  }
}

export const jellyfinAdapter = new JellyfinAdapter();
