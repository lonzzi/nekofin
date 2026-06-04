import type { ImageUrlInfo } from '@/lib/utils/image';
import { CardShapes, getShapeFromItemType, isPerson } from '@/lib/utils/items';
import {
  BaseItemKind,
  ImageType,
  type BaseItemDto,
} from '@jellyfin/sdk/lib/generated-client/models';

import type { GetImageInfoParams, MediaItem, MediaPerson } from '../types';
import { getBlurHash, getUnderlyingRaw, isBaseItemDto } from './helpers';
import type { EmbyApi } from './types';

export function getEmbyImageInfo({
  api,
  item,
  opts,
}: {
  api: EmbyApi;
  item: MediaItem | MediaPerson;
  opts?: GetImageInfoParams['opts'];
}): ImageUrlInfo {
  const baseItemCandidate = getUnderlyingRaw(item);

  if (!isBaseItemDto(baseItemCandidate)) {
    return { url: undefined, blurhash: undefined };
  }

  const { preferBackdrop, preferBanner, preferLogo, preferThumb, width } = opts ?? {};
  const inheritThumb = true;
  const tag = '';

  const itemData = baseItemCandidate as BaseItemDto;

  let imgType: string = 'Primary';
  let imgTag;
  let itemId: string | null | undefined = itemData.Id;
  let height;

  const shape = isPerson(itemData) ? CardShapes.Portrait : getShapeFromItemType(itemData.Type);

  if (tag && preferBackdrop) {
    imgType = ImageType.Backdrop;
    imgTag = tag;
  } else if (tag && preferBanner) {
    imgType = ImageType.Banner;
    imgTag = tag;
  } else if (tag && preferLogo) {
    imgType = ImageType.Logo;
    imgTag = tag;
  } else if (tag && preferThumb) {
    imgType = ImageType.Thumb;
    imgTag = tag;
  } else if (tag) {
    imgType = ImageType.Primary;
    imgTag = tag;
  } else if (isPerson(itemData)) {
    imgType = ImageType.Primary;
    imgTag = itemData.PrimaryImageTag;
  } else if (preferThumb && itemData.ImageTags?.Thumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.ImageTags.Thumb;
  } else if ((preferBanner || shape === CardShapes.Banner) && itemData.ImageTags?.Banner) {
    imgType = ImageType.Banner;
    imgTag = itemData.ImageTags.Banner;
  } else if (preferLogo && itemData.ImageTags?.Logo) {
    imgType = ImageType.Logo;
    imgTag = itemData.ImageTags.Logo;
  } else if (preferBackdrop && itemData.BackdropImageTags?.[0]) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.BackdropImageTags[0];
  } else if (preferLogo && itemData.ParentLogoImageTag && itemData.ParentLogoItemId) {
    imgType = ImageType.Logo;
    imgTag = itemData.ParentLogoImageTag;
    itemId = itemData.ParentLogoItemId;
  } else if (
    preferBackdrop &&
    itemData.ParentBackdropImageTags?.[0] &&
    itemData.ParentBackdropItemId
  ) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.ParentBackdropImageTags[0];
    itemId = itemData.ParentBackdropItemId;
  } else if (preferThumb && itemData.SeriesThumbImageTag && inheritThumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.SeriesThumbImageTag;
    itemId = itemData.SeriesId;
  } else if (
    preferThumb &&
    itemData.ParentThumbItemId &&
    inheritThumb &&
    itemData.MediaType !== 'Photo'
  ) {
    imgType = ImageType.Thumb;
    imgTag = itemData.ParentThumbImageTag;
    itemId = itemData.ParentThumbItemId;
  } else if (preferThumb && itemData.BackdropImageTags?.length) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.BackdropImageTags[0];
  } else if (
    preferThumb &&
    itemData.ParentBackdropImageTags?.length &&
    inheritThumb &&
    itemData.Type === BaseItemKind.Episode
  ) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.ParentBackdropImageTags[0];
    itemId = itemData.ParentBackdropItemId;
  } else if (
    itemData.ImageTags?.Primary &&
    (itemData.Type !== BaseItemKind.Episode || itemData.ChildCount !== 0)
  ) {
    imgType = ImageType.Primary;
    imgTag = itemData.ImageTags.Primary;
    height =
      width && itemData.PrimaryImageAspectRatio
        ? Math.round(width / itemData.PrimaryImageAspectRatio)
        : undefined;
  } else if (itemData.SeriesPrimaryImageTag) {
    imgType = ImageType.Primary;
    imgTag = itemData.SeriesPrimaryImageTag;
    itemId = itemData.SeriesId;
  } else if (itemData.ParentPrimaryImageTag) {
    imgType = ImageType.Primary;
    imgTag = itemData.ParentPrimaryImageTag;
    itemId = itemData.ParentPrimaryImageItemId;
  } else if (itemData.AlbumId && itemData.AlbumPrimaryImageTag) {
    imgType = ImageType.Primary;
    imgTag = itemData.AlbumPrimaryImageTag;
    itemId = itemData.AlbumId;
    height =
      width && itemData.PrimaryImageAspectRatio
        ? Math.round(width / itemData.PrimaryImageAspectRatio)
        : undefined;
  } else if (itemData.Type === BaseItemKind.Season && itemData.ImageTags?.Thumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.ImageTags.Thumb;
  } else if (itemData.BackdropImageTags?.length) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.BackdropImageTags[0];
  } else if (itemData.ImageTags?.Thumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.ImageTags.Thumb;
  } else if (itemData.SeriesThumbImageTag && inheritThumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.SeriesThumbImageTag;
    itemId = itemData.SeriesId;
  } else if (itemData.ParentThumbItemId && inheritThumb) {
    imgType = ImageType.Thumb;
    imgTag = itemData.ParentThumbImageTag;
    itemId = itemData.ParentThumbItemId;
  } else if (itemData.ParentBackdropImageTags?.length && inheritThumb) {
    imgType = ImageType.Backdrop;
    imgTag = itemData.ParentBackdropImageTags[0];
    itemId = itemData.ParentBackdropItemId;
  }

  if (!imgTag) {
    return { url: undefined, blurhash: undefined };
  }

  const params = new URLSearchParams();
  params.set('tag', imgTag);
  if (opts?.width) params.set('maxWidth', String(opts.width));
  if (opts?.height) params.set('maxHeight', String(opts.height));
  params.set('quality', '90');

  const url = `${api.basePath}/Items/${itemId}/Images/${imgType}?${params.toString()}`;
  const blurhash = getBlurHash(itemData, imgType);

  return {
    url,
    blurhash,
  };
}
