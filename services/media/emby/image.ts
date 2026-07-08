import type { ImageUrlInfo } from '@/lib/utils/image';
import { resolveImageCandidate } from '@/lib/utils/imageCandidates';
import { ImageType, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

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

  const itemData = baseItemCandidate as BaseItemDto;
  const { preferBackdrop, preferBanner, preferLogo, preferThumb, width } = opts ?? {};

  // The image-type priority ladder is identical across Jellyfin and Emby; only
  // the URL transport differs. Reuse the shared resolver and build the Emby URL.
  const { imageType, imageTag, itemId } = resolveImageCandidate(itemData, {
    preferBackdrop,
    preferBanner,
    preferLogo,
    preferThumb,
    width,
  });

  if (!imageTag) {
    return { url: undefined, blurhash: undefined };
  }

  const imgType = imageType ?? ImageType.Primary;
  const params = new URLSearchParams();
  params.set('tag', imageTag);
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
