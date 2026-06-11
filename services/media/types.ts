import type { ImageUrlInfo } from '@/lib/utils/image';
import type { RecommendedServerInfo } from '@jellyfin/sdk';
import type { BaseItemPersonImageBlurHashes } from '@jellyfin/sdk/lib/generated-client/models/base-item-person-image-blur-hashes';

import type { StreamInfo } from './jellyfin/stream';

export type MediaApi = {
  basePath: string;
  accessToken: string | null;
};

export type MediaServerType = 'jellyfin' | 'emby';

export type MediaItemType = 'Movie' | 'Series' | 'Season' | 'Episode' | 'MusicVideo' | 'Other';

export type MediaSortBy =
  | 'DateCreated'
  | 'SortName'
  | 'IndexNumber'
  | 'IsFavoriteOrLiked'
  | 'Random'
  | 'CommunityRating'
  | 'DatePlayed'
  | 'OfficialRating'
  | 'PremiereDate';
export type MediaSortOrder = 'Ascending' | 'Descending';

export interface MediaUserData {
  played?: boolean | null;
  playedPercentage?: number | null;
  isFavorite?: boolean | null;
  playbackPositionTicks?: number | null;
}

export interface MediaPerson {
  name?: string | null;
  id: string;
  type?: 'Actor' | 'Director' | 'Writer' | 'Producer';
  role?: string | null;
  primaryImageTag?: string | null;
  imageBlurHashes?: BaseItemPersonImageBlurHashes | null;
  raw: unknown;
}

export interface MediaGenre {
  name: string;
}

export interface MediaStudio {
  name: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaItemType;
  raw: unknown;
  seriesName?: string | null;
  seriesId?: string | null;
  parentId?: string | null;
  indexNumber?: number | null;
  parentIndexNumber?: number | null;
  productionYear?: number | null;
  endDate?: string | null;
  status?: 'Continuing' | 'Ended';
  overview?: string | null;
  communityRating?: number | null;
  criticRating?: number | null;
  officialRating?: string | null;
  genres?: string[] | null;
  genreItems?: MediaGenre[] | null;
  people?: MediaPerson[] | null;
  studios?: MediaStudio[] | null;
  userData?: MediaUserData | null;
  runTimeTicks?: number | null;
  originalTitle?: string | null;
  seasonId?: string | null;
  collectionType?: string;
}

export interface MediaUser {
  id: string;
  name: string;
  serverName?: string | null;
  avatar?: string | null;
}

export interface MediaSystemInfo {
  serverName?: string | null;
  version?: string | null;
  operatingSystem?: string | null;
}

export interface MediaPlaybackInfo {
  mediaSources: MediaSource[];
}

export interface MediaPage<T> {
  items: T[];
  total?: number;
}

export interface MediaSource {
  id: string;
  protocol: string;
  container: string;
  size?: number | null;
  bitrate?: number | null;
  mediaStreams: MediaStream[];
}

export interface MediaStream {
  codec: string;
  type: 'Video' | 'Audio' | 'Subtitle';
  index: number;
  language?: string | null;
  isDefault?: boolean | null;
  isForced?: boolean | null;
  width?: number | null;
  height?: number | null;
  bitRate?: number | null;
  // Video specific
  averageFrameRate?: number | null;
  realFrameRate?: number | null;
  profile?: string | null;
  level?: number | null;
  pixelFormat?: string | null;
  bitDepth?: number | null;
  isInterlaced?: boolean | null;
  aspectRatio?: string | null;
  videoRange?: string | null;
  // Audio specific
  channels?: number | null;
  channelLayout?: string | null;
  sampleRate?: number | null;
  audioProfile?: string | null;
  title?: string | null;
}

export interface MediaStreamInfo {
  url: string | null;
  sessionId: string | null;
  mediaSource: MediaSource | undefined;
}

export interface MediaFilters {
  years: number[];
  tags: string[];
  genres: string[];
}

export interface MediaServerInfo {
  id: string;
  address: string;
  name: string;
  note?: string;
  userId: string;
  username: string;
  userAvatar: string;
  accessToken: string;
  createdAt: number;
  type: MediaServerType;
}

// 占位的抽象类已下移整合

// Params 类型提取
export interface DiscoverServersParams {
  host: string;
}
export interface FindBestServerParams {
  servers: RecommendedServerInfo[];
}
export interface CreateApiParams {
  address: string;
}
export interface CreateApiFromServerInfoParams {
  serverInfo: MediaServerInfo;
}

// Auth & User
export interface LoginParams {
  username: string;
  password: string;
}
export interface AuthenticateAndSaveServerParams {
  address: string;
  username: string;
  password: string;
  name?: string;
  note?: string;
  addServer: (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => Promise<void>;
}
export interface GetUserInfoParams {
  userId: string;
}

// Items common
// 基础可复用片段
export type WithUserId = { userId: string };
export type WithLimit = { limit?: number };
export type WithPaging = { startIndex?: number; limit?: number };
export type WithFolderId = { folderId: string };
export type WithItemId = { itemId: string };
export type WithSeriesId = { seriesId: string };
export type WithSeasonId = { seasonId: string };
export type WithFilterOptions = {
  includeItemTypes?: MediaItemType[];
  sortBy?: MediaSortBy[];
  sortOrder?: MediaSortOrder;
  onlyUnplayed?: boolean;
  year?: number;
  tags?: string[];
};
export type MediaItemQueryFilters = WithFilterOptions;

// 组合别名（保持原导出名不变）
export type GetLatestItemsParams = WithUserId & WithLimit & Omit<WithFilterOptions, 'onlyUnplayed'>;
export type GetLatestItemsByFolderParams = WithUserId & WithFolderId & WithLimit;
export type GetNextUpItemsParams = WithUserId & WithLimit;
export type GetNextUpItemsByFolderParams = WithUserId & WithFolderId & WithLimit;
export type GetResumeItemsParams = WithUserId & WithLimit;
export type GetFavoriteItemsParams = WithUserId & WithLimit;
export type GetFavoriteItemsPagedParams = WithUserId & WithPaging & WithFilterOptions;
export type GetItemDetailParams = WithItemId & WithUserId;
export type GetItemMediaSourcesParams = WithItemId;
export type GetUserViewParams = WithUserId;
export type GetAllItemsByFolderParams = WithUserId &
  WithFolderId &
  WithPaging &
  WithFilterOptions & {
    itemTypes?: MediaItemType[];
  };
export type GetSeasonsBySeriesParams = WithUserId & WithSeriesId;
export type GetEpisodesBySeasonParams = WithUserId & WithSeasonId;
export type GetSimilarShowsParams = WithItemId & WithUserId & WithLimit;
export type GetSimilarMoviesParams = WithItemId & WithUserId & WithLimit;
export type SearchItemsParams = WithUserId & { searchTerm: string } & WithLimit & {
    includeItemTypes?: MediaItemType[];
  };
export type GetRecommendedSearchKeywordsParams = WithUserId & WithLimit;
export type GetRandomItemsParams = WithUserId & WithLimit;
export type GetAvailableFiltersParams = WithUserId & { parentId?: string };
export interface GetImageInfoParams {
  item: MediaItem | MediaPerson;
  opts?: {
    width?: number;
    height?: number;
    preferBackdrop?: boolean;
    preferLogo?: boolean;
    preferThumb?: boolean;
    preferBanner?: boolean;
  };
}
export interface GetStreamInfoParams {
  item: MediaItem | null | undefined;
  userId: string | null | undefined;
  startTimeTicks: number;
  maxStreamingBitrate?: number;
  playSessionId?: string | null;
  deviceProfile: unknown;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  height?: number;
  mediaSourceId?: string | null;
  deviceId?: string | null;
  alwaysBurnInSubtitleWhenTranscoding?: boolean;
}
export interface UpdateFavoriteItemParams {
  userId: string;
  itemId: string;
}
export interface MarkItemPlayedParams {
  userId: string;
  itemId: string;
  datePlayed?: string;
}
export interface ReportPlaybackProgressParams {
  itemId: string;
  positionTicks: number;
  isPaused?: boolean;
  PlaySessionId: string;
}
export interface ReportPlaybackStartParams {
  itemId: string;
  positionTicks?: number;
  PlaySessionId: string;
}
export interface ReportPlaybackStopParams {
  itemId: string;
  positionTicks: number;
  PlaySessionId: string;
}

export abstract class MediaAdapter {
  _api: MediaApi | null = null;

  setApi(api: MediaApi | null): void {
    this._api = api;
  }

  getApi(): MediaApi | null {
    return this._api;
  }

  abstract discoverServers(params: DiscoverServersParams): Promise<RecommendedServerInfo[]>;
  abstract findBestServer(params: FindBestServerParams): RecommendedServerInfo | null;

  abstract createApi(params: CreateApiParams): MediaApi;
  abstract createApiFromServerInfo(params: CreateApiFromServerInfoParams): MediaApi;

  abstract getSystemInfo(): Promise<MediaSystemInfo>;
  abstract getPublicUsers(): Promise<MediaUser[]>;
  abstract login(params: LoginParams): Promise<unknown>;
  abstract authenticateAndSaveServer(params: AuthenticateAndSaveServerParams): Promise<unknown>;

  abstract getLatestItems(params: GetLatestItemsParams): Promise<MediaPage<MediaItem>>;
  abstract getLatestItemsByFolder(
    params: GetLatestItemsByFolderParams,
  ): Promise<MediaPage<MediaItem>>;
  abstract getNextUpItems(params: GetNextUpItemsParams): Promise<MediaPage<MediaItem>>;
  abstract getNextUpItemsByFolder(
    params: GetNextUpItemsByFolderParams,
  ): Promise<MediaPage<MediaItem>>;
  abstract getResumeItems(params: GetResumeItemsParams): Promise<MediaPage<MediaItem>>;
  abstract getFavoriteItems(params: GetFavoriteItemsParams): Promise<MediaPage<MediaItem>>;
  abstract getFavoriteItemsPaged(
    params: GetFavoriteItemsPagedParams,
  ): Promise<MediaPage<MediaItem>>;
  abstract logout(): Promise<void>;
  abstract getUserInfo(params: GetUserInfoParams): Promise<MediaUser>;
  abstract getItemDetail(params: GetItemDetailParams): Promise<MediaItem>;
  abstract getItemMediaSources(params: GetItemMediaSourcesParams): Promise<MediaPlaybackInfo>;
  abstract getUserView(params: GetUserViewParams): Promise<MediaItem[]>;
  abstract getAllItemsByFolder(params: GetAllItemsByFolderParams): Promise<MediaPage<MediaItem>>;
  abstract getSeasonsBySeries(params: GetSeasonsBySeriesParams): Promise<MediaPage<MediaItem>>;
  abstract getEpisodesBySeason(params: GetEpisodesBySeasonParams): Promise<MediaPage<MediaItem>>;
  abstract getSimilarShows(params: GetSimilarShowsParams): Promise<MediaPage<MediaItem>>;
  abstract getSimilarMovies(params: GetSimilarMoviesParams): Promise<MediaPage<MediaItem>>;
  abstract searchItems(params: SearchItemsParams): Promise<MediaItem[]>;
  abstract getRecommendedSearchKeywords(
    params: GetRecommendedSearchKeywordsParams,
  ): Promise<string[]>;
  abstract getRandomItems(params: GetRandomItemsParams): Promise<MediaItem[]>;
  abstract getAvailableFilters(params: GetAvailableFiltersParams): Promise<MediaFilters>;
  abstract getImageInfo(params: GetImageInfoParams): ImageUrlInfo;
  abstract getStreamInfo(params: GetStreamInfoParams): Promise<StreamInfo | null>;
  abstract addFavoriteItem(params: UpdateFavoriteItemParams): Promise<void>;
  abstract removeFavoriteItem(params: UpdateFavoriteItemParams): Promise<void>;
  abstract markItemPlayed(params: MarkItemPlayedParams): Promise<void>;
  abstract markItemUnplayed(params: UpdateFavoriteItemParams): Promise<void>;
  abstract reportPlaybackProgress(params: ReportPlaybackProgressParams): Promise<void>;
  abstract reportPlaybackStart(params: ReportPlaybackStartParams): Promise<void>;
  abstract reportPlaybackStop(params: ReportPlaybackStopParams): Promise<void>;
}
