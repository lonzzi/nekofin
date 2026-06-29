import type { BaseItemPersonImageBlurHashes } from '@jellyfin/sdk/lib/generated-client/models/base-item-person-image-blur-hashes';

import type { MediaItem, MediaItemType } from '../types';

export type EmbyBaseItemDto = {
  Id?: string | null;
  Name?: string | null;
  Type?: string | null;
  SeriesName?: string | null;
  SeriesId?: string | null;
  ParentId?: string | null;
  IndexNumber?: number | null;
  ParentIndexNumber?: number | null;
  ProductionYear?: number | null;
  PremiereDate?: string | null;
  DateCreated?: string | null;
  EndDate?: string | null;
  Status?: string | null;
  Overview?: string | null;
  Taglines?: string[] | null;
  Tags?: string[] | null;
  CommunityRating?: number | null;
  CriticRating?: number | null;
  OfficialRating?: string | null;
  Genres?: string[] | null;
  GenreItems?: { Name?: string | null }[] | null;
  ProductionLocations?: string[] | null;
  People?:
    | {
        Id?: string | null;
        Name?: string | null;
        Type?: string | null;
        Role?: string | null;
        PrimaryImageTag?: string | null;
        ImageBlurHashes?: BaseItemPersonImageBlurHashes | null;
      }[]
    | null;
  Studios?: { Name?: string | null }[] | null;
  UserData?: {
    Played?: boolean | null;
    PlayedPercentage?: number | null;
    IsFavorite?: boolean | null;
    PlaybackPositionTicks?: number | null;
  } | null;
  RunTimeTicks?: number | null;
  CumulativeRunTimeTicks?: number | null;
  OriginalTitle?: string | null;
  SeasonId?: string | null;
  RecursiveItemCount?: number | null;
  ChildCount?: number | null;
  MediaSourceCount?: number | null;
  Container?: string | null;
  CollectionType?: string | null;
};

export function convertEmbyItemToMediaItem(item: EmbyBaseItemDto): MediaItem {
  return {
    id: item.Id || '',
    name: item.Name || '',
    type: (item.Type as MediaItemType) || 'Other',
    raw: item,
    seriesName: item.SeriesName,
    seriesId: item.SeriesId,
    parentId: item.ParentId,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    productionYear: item.ProductionYear,
    premiereDate: item.PremiereDate,
    dateCreated: item.DateCreated,
    endDate: item.EndDate,
    status: item.Status as 'Continuing' | 'Ended' | undefined,
    overview: item.Overview,
    taglines: item.Taglines,
    tags: item.Tags,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    officialRating: item.OfficialRating,
    genres: item.Genres,
    genreItems: item.GenreItems?.map((g) => ({ name: g.Name || '' })),
    productionLocations: item.ProductionLocations,
    people: item.People?.map((p) => ({
      name: p.Name || '',
      id: p.Id || '',
      type: (p.Type as 'Actor' | 'Director' | 'Writer' | 'Producer') || 'Actor',
      role: p.Role,
      primaryImageTag: p.PrimaryImageTag,
      imageBlurHashes: p.ImageBlurHashes,
      raw: p,
    })),
    studios: item.Studios?.map((s) => ({ name: s.Name || '' })),
    userData: item.UserData
      ? {
          played: item.UserData.Played,
          playedPercentage: item.UserData.PlayedPercentage,
          isFavorite: item.UserData.IsFavorite,
          playbackPositionTicks: item.UserData.PlaybackPositionTicks,
        }
      : undefined,
    runTimeTicks: item.RunTimeTicks,
    cumulativeRunTimeTicks: item.CumulativeRunTimeTicks,
    originalTitle: item.OriginalTitle,
    seasonId: item.SeasonId,
    recursiveItemCount: item.RecursiveItemCount,
    childCount: item.ChildCount,
    mediaSourceCount: item.MediaSourceCount,
    container: item.Container,
    collectionType: item.CollectionType ?? undefined,
  };
}
