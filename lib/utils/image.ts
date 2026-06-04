/**
 * Helper for image manipulation and image-related utility functions
 *
 */
import type { Api } from '@jellyfin/sdk';
import {
  BaseItemKind,
  ImageType,
  type BaseItemDto,
  type BaseItemPerson,
  type UserDto,
} from '@jellyfin/sdk/lib/generated-client';
import type { ImageRequestParameters } from '@jellyfin/sdk/lib/models/api/image-request-parameters';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import type { ImageUrlsApi } from '@jellyfin/sdk/lib/utils/api/image-urls-api';

import { isNil } from './guards';
import { resolveImageCandidate } from './imageCandidates';
import { CardShapes, getShapeFromItemType, isPerson } from './items';

export interface ImageUrlInfo {
  url?: string;
  blurhash?: string;
}

const excludedBlurhashTypes = Object.freeze(new Set<ImageType>([ImageType.Logo]));

const imageDefaultOptions = (): ImageRequestParameters => ({ format: 'Webp' });

/**
 * Gets the image URL given an item id and the image type requested
 */
export function getItemImageUrl(
  api: Api,
  ...args: Parameters<ImageUrlsApi['getItemImageUrlById']>
) {
  const argsLen = args.length;

  switch (argsLen) {
    case 1: {
      args.push(undefined, imageDefaultOptions());
      break;
    }
    case 2: {
      args.push(imageDefaultOptions());
      break;
    }
    case 3: {
      args[2] = { ...args[2], ...imageDefaultOptions() };
      break;
    }
  }

  return getImageApi(api).getItemImageUrlById(...args);
}

/**
 * Gets the logged's user image URL
 */
export function getUserImageUrl(api: Api, user?: UserDto) {
  return getImageApi(api).getUserImageUrl(user, imageDefaultOptions());
}

/**
 * Gets the image url with the desired size and quality.
 */
function getImageUrlWithSize(
  api: Api | null | undefined,
  itemId: string,
  {
    width,
    height,
    quality,
    ratio = 1,
  }: {
    width?: number;
    height?: number;
    quality?: number;
    ratio?: number;
  } = {},
  imgType?: ImageType,
) {
  if (!api) {
    return undefined;
  }

  return getItemImageUrl(api, itemId, imgType, {
    quality,
    maxWidth: isNil(width) ? undefined : Math.round(width * ratio),
    maxHeight: isNil(height) ? undefined : Math.round(height * ratio),
  });
}

/**
 * Gets the tag of the image of an specific item and type.
 *
 * @param item - The item object.
 * @param type - The type of the image requested.
 * @param [index=0] - Index of the Backdrop image (when ImageType equals to 'Backdrop').
 * @param [checkParent=true] - Looks for tag/image type for the parent if the passed item doesn't have the ImageType requested
 * @returns Returns the tag, undefined if the specific ImageType doesn't exist.
 */
export function getImageTag(
  item: BaseItemDto | BaseItemPerson,
  type: ImageType,
  index = 0,
  checkParent = true,
): string | undefined {
  if (isPerson(item)) {
    return item.PrimaryImageTag && type === ImageType.Primary ? item.PrimaryImageTag : undefined;
  }

  if (item.ImageTags?.[type]) {
    return item.ImageTags[type];
  } else if (type === ImageType.Backdrop && item.BackdropImageTags?.[index]) {
    return item.BackdropImageTags[index];
  }

  if (checkParent) {
    switch (type) {
      case ImageType.Primary: {
        return (
          item.AlbumPrimaryImageTag ??
          item.ChannelPrimaryImageTag ??
          item.ParentPrimaryImageTag ??
          undefined
        );
      }
      case ImageType.Art: {
        return item.ParentArtImageTag ?? undefined;
      }
      case ImageType.Backdrop: {
        return item.ParentBackdropImageTags?.[index] ?? undefined;
      }
      case ImageType.Logo: {
        return item.ParentLogoImageTag ?? undefined;
      }
      case ImageType.Thumb: {
        return item.ParentThumbImageTag ?? undefined;
      }
    }
  }
}

/**
 * Gets the itemId of the parent element.
 *
 * @param item - The item object.
 * @returns Returns the parent itemId, undefined if it doesn't exist.
 */
export function getParentId(item: BaseItemDto): string | undefined {
  if (item.AlbumId) {
    return item.AlbumId;
  } else if (item.ChannelId) {
    return item.ChannelId;
  } else if (item.SeriesId) {
    return item.SeriesId;
  } else if (item.ParentArtItemId) {
    return item.ParentArtItemId;
  } else if (item.ParentPrimaryImageItemId) {
    return item.ParentPrimaryImageItemId;
  } else if (item.ParentThumbItemId) {
    return item.ParentThumbItemId;
  } else if (item.ParentBackdropItemId) {
    return item.ParentBackdropItemId;
  } else if (item.ParentLogoItemId) {
    return item.ParentLogoItemId;
  } else if (item.SeasonId) {
    return item.SeasonId;
  } else if (item.ParentId) {
    return item.ParentId;
  }
}

/**
 * Gets the blurhash string of an image given the item and the image type desired.
 *
 * @param item - The item object.
 * @param type - The type of the image requested.
 * @param [index=0] - Index of the Backdrop image (when ImageType equals to 'Backdrop').
 * @param [checkParent=true] - Checks for the parent's images blurhash (in case the provided item doesn't have it)
 * @returns Returns the tag, undefined if the specific ImageType doesn't exist.
 */
export function getBlurhash(
  item: BaseItemDto | BaseItemPerson,
  type: ImageType,
  index = 0,
  checkParent = true,
): string | undefined {
  const tag = getImageTag(item, type, index, checkParent);

  if (tag && !excludedBlurhashTypes.has(type) && item.ImageBlurHashes?.[type]?.[tag]) {
    return item.ImageBlurHashes[type][tag];
  }
}

/**
 * Gets the desired aspect ratio based on card shape
 * @param shape
 * @returns
 */
export function getDesiredAspect(shape: CardShapes): number {
  let aspectRatio;

  switch (shape) {
    case CardShapes.Portrait: {
      aspectRatio = 2 / 3;
      break;
    }
    case CardShapes.Thumb: {
      aspectRatio = 16 / 9;
      break;
    }
    case CardShapes.Banner: {
      aspectRatio = 1000 / 185;
      break;
    }
    default: {
      aspectRatio = 1;
      break;
    }
  }

  return aspectRatio;
}

/**
 * Generates the image information for a BaseItemDto or a BasePersonDto according to set priorities.
 *
 * @param item - Item to get image information for
 * @param [options] - Optional parameters for the function.
 * @param [options.shape] - Shape of the card or element, used to determine what kind of image to prefer
 * @param [options.preferThumb=false] - Prefer the Thumb images
 * @param [options.preferBanner=false] - Prefer the Banner images
 * @param [options.preferLogo=false] - Prefer the Logo images
 * @param [options.preferBackdrop=false] - Prefer the Backdrop images
 * @param [options.inheritThumb=false] - Inherit the thumb from parent items
 * @param [options.quality=90] - Sets the quality of the returned image
 * @param [options.width] - Sets the requested width of the image
 * @param [options.ratio=1] - Sets the device pixel ratio for the image, used for computing the real image size
 * @param [options.tag] - Sets a specific image tag to get, bypassing the automatic priorities.
 * @returns Information for the item, containing the full URL and blurhash.
 */
export function getImageInfo(
  item: BaseItemDto | BaseItemPerson,
  {
    shape = isPerson(item) ? CardShapes.Portrait : getShapeFromItemType(item.Type),
    preferThumb = false,
    preferBanner = false,
    preferLogo = false,
    preferBackdrop = false,
    inheritThumb = true,
    quality = 90,
    width,
    ratio = 1,
    tag,
  }: {
    shape?: CardShapes;
    preferThumb?: boolean;
    preferBanner?: boolean;
    preferLogo?: boolean;
    preferBackdrop?: boolean;
    inheritThumb?: boolean;
    quality?: number;
    width?: number;
    ratio?: number;
    tag?: string;
  } = {},
  api?: Api | null,
): ImageUrlInfo {
  const { imageType, imageTag, itemId, height } = resolveImageCandidate(item, {
    shape,
    preferThumb,
    preferBanner,
    preferLogo,
    preferBackdrop,
    inheritThumb,
    width,
    tag,
  });

  if (!itemId) {
    return {
      url: undefined,
      blurhash: undefined,
    };
  }

  return {
    url: getImageUrlWithSize(
      api,
      itemId,
      {
        width,
        height,
        quality,
        ratio,
      },
      imageType,
    ),
    blurhash: imageType && imageTag ? item.ImageBlurHashes?.[imageType]?.[imageTag] : undefined,
  };
}

/**
 * Generates the logo information for a BaseItemDto or a BasePersonDto according to set priorities.
 *
 * @param item - Item to get image information for
 * @param [options] - Optional parameters for the function.
 * @param [options.quality=90] - Sets the quality of the returned image
 * @param [options.width] - Sets the requested width of the image
 * @param [options.ratio=1] - Sets the device pixel ratio for the image, used for computing the real image size
 * @param [options.tag] - Sets a specific image tag to get, bypassing the automatic priorities.
 * @returns Information for the item, containing the full URL, image tag and blurhash.
 */
export function getLogo(
  api: Api | null | undefined,
  item: BaseItemDto,
  {
    quality = 90,
    width,
    ratio = 1,
    tag,
  }: {
    quality?: number;
    width?: number;
    ratio?: number;
    tag?: string;
  } = {},
): ImageUrlInfo {
  const imgType = ImageType.Logo;
  let imgTag;
  let itemId: string | null | undefined = item.Id;

  if (tag) {
    imgTag = tag;
  } else if (item.ImageTags?.Logo) {
    imgTag = item.ImageTags.Logo;
  } else if (item.ParentLogoImageTag && item.ParentLogoItemId) {
    imgTag = item.ParentLogoImageTag;
    itemId = item.ParentLogoItemId;
  }

  return {
    url: isNil(imgTag)
      ? undefined
      : getImageUrlWithSize(
          api,
          itemId ?? '',
          {
            width,
            quality,
            ratio,
          },
          imgType,
        ),
    blurhash: imgTag ? item.ImageBlurHashes?.[imgType]?.[imgTag] : undefined,
  };
}
