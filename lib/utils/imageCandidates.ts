import {
  BaseItemKind,
  ImageType,
  type BaseItemDto,
  type BaseItemPerson,
} from '@jellyfin/sdk/lib/generated-client';

import { CardShapes, getShapeFromItemType, isPerson } from './items';

export interface ImageInfoOptions {
  shape?: CardShapes;
  preferThumb?: boolean;
  preferBanner?: boolean;
  preferLogo?: boolean;
  preferBackdrop?: boolean;
  inheritThumb?: boolean;
  width?: number;
  tag?: string;
}

export interface ImageCandidate {
  imageType?: ImageType;
  imageTag?: string;
  itemId?: string | null;
  height?: number;
}

const heightFromAspectRatio = (width: number | undefined, ratio: number | null | undefined) =>
  width && ratio ? Math.round(width / ratio) : undefined;

export function resolveImageCandidate(
  item: BaseItemDto | BaseItemPerson,
  {
    shape = isPerson(item) ? CardShapes.Portrait : getShapeFromItemType(item.Type),
    preferThumb = false,
    preferBanner = false,
    preferLogo = false,
    preferBackdrop = false,
    inheritThumb = true,
    width,
    tag,
  }: ImageInfoOptions = {},
): ImageCandidate {
  let imageType;
  let imageTag;
  let itemId: string | null | undefined = item.Id;
  let height;

  if (tag && preferBackdrop) {
    imageType = ImageType.Backdrop;
    imageTag = tag;
  } else if (tag && preferBanner) {
    imageType = ImageType.Banner;
    imageTag = tag;
  } else if (tag && preferLogo) {
    imageType = ImageType.Logo;
    imageTag = tag;
  } else if (tag && preferThumb) {
    imageType = ImageType.Thumb;
    imageTag = tag;
  } else if (tag) {
    imageType = ImageType.Primary;
    imageTag = tag;
  } else if (isPerson(item)) {
    imageType = ImageType.Primary;
    imageTag = item.PrimaryImageTag;
  } else if (preferThumb && item.ImageTags?.Thumb) {
    imageType = ImageType.Thumb;
    imageTag = item.ImageTags.Thumb;
  } else if ((preferBanner || shape === CardShapes.Banner) && item.ImageTags?.Banner) {
    imageType = ImageType.Banner;
    imageTag = item.ImageTags.Banner;
  } else if (preferLogo && item.ImageTags?.Logo) {
    imageType = ImageType.Logo;
    imageTag = item.ImageTags.Logo;
  } else if (preferBackdrop && item.BackdropImageTags?.[0]) {
    imageType = ImageType.Backdrop;
    imageTag = item.BackdropImageTags[0];
  } else if (preferLogo && item.ParentLogoImageTag && item.ParentLogoItemId) {
    imageType = ImageType.Logo;
    imageTag = item.ParentLogoImageTag;
    itemId = item.ParentLogoItemId;
  } else if (preferBackdrop && item.ParentBackdropImageTags?.[0] && item.ParentBackdropItemId) {
    imageType = ImageType.Backdrop;
    imageTag = item.ParentBackdropImageTags[0];
    itemId = item.ParentBackdropItemId;
  } else if (preferThumb && item.SeriesThumbImageTag && inheritThumb) {
    imageType = ImageType.Thumb;
    imageTag = item.SeriesThumbImageTag;
    itemId = item.SeriesId;
  } else if (preferThumb && item.ParentThumbItemId && inheritThumb && item.MediaType !== 'Photo') {
    imageType = ImageType.Thumb;
    imageTag = item.ParentThumbImageTag;
    itemId = item.ParentThumbItemId;
  } else if (preferThumb && item.BackdropImageTags?.length) {
    imageType = ImageType.Backdrop;
    imageTag = item.BackdropImageTags[0];
  } else if (
    preferThumb &&
    item.ParentBackdropImageTags?.length &&
    inheritThumb &&
    item.Type === BaseItemKind.Episode
  ) {
    imageType = ImageType.Backdrop;
    imageTag = item.ParentBackdropImageTags[0];
    itemId = item.ParentBackdropItemId;
  } else if (
    item.ImageTags?.Primary &&
    (item.Type !== BaseItemKind.Episode || item.ChildCount !== 0)
  ) {
    imageType = ImageType.Primary;
    imageTag = item.ImageTags.Primary;
    height = heightFromAspectRatio(width, item.PrimaryImageAspectRatio);
  } else if (item.SeriesPrimaryImageTag) {
    imageType = ImageType.Primary;
    imageTag = item.SeriesPrimaryImageTag;
    itemId = item.SeriesId;
  } else if (item.ParentPrimaryImageTag) {
    imageType = ImageType.Primary;
    imageTag = item.ParentPrimaryImageTag;
    itemId = item.ParentPrimaryImageItemId;
  } else if (item.AlbumId && item.AlbumPrimaryImageTag) {
    imageType = ImageType.Primary;
    imageTag = item.AlbumPrimaryImageTag;
    itemId = item.AlbumId;
    height = heightFromAspectRatio(width, item.PrimaryImageAspectRatio);
  } else if (item.Type === BaseItemKind.Season && item.ImageTags?.Thumb) {
    imageType = ImageType.Thumb;
    imageTag = item.ImageTags.Thumb;
  } else if (item.BackdropImageTags?.length) {
    imageType = ImageType.Backdrop;
    imageTag = item.BackdropImageTags[0];
  } else if (item.ImageTags?.Thumb) {
    imageType = ImageType.Thumb;
    imageTag = item.ImageTags.Thumb;
  } else if (item.SeriesThumbImageTag && inheritThumb) {
    imageType = ImageType.Thumb;
    imageTag = item.SeriesThumbImageTag;
    itemId = item.SeriesId;
  } else if (item.ParentThumbItemId && inheritThumb) {
    imageType = ImageType.Thumb;
    imageTag = item.ParentThumbImageTag;
    itemId = item.ParentThumbItemId;
  } else if (item.ParentBackdropImageTags?.length && inheritThumb) {
    imageType = ImageType.Backdrop;
    imageTag = item.ParentBackdropImageTags[0];
    itemId = item.ParentBackdropItemId;
  }

  return {
    imageType,
    imageTag: imageTag ?? undefined,
    itemId: itemId || item.Id,
    height,
  };
}
