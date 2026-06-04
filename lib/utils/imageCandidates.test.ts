import { BaseItemKind, ImageType, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { describe, expect, it } from 'vitest';

import { resolveImageCandidate } from './imageCandidates';

const item = (item: Partial<BaseItemDto>): BaseItemDto => ({
  Id: 'item-1',
  Type: BaseItemKind.Movie,
  ...item,
});

describe('resolveImageCandidate', () => {
  it('uses explicitly tagged images with the preferred image type', () => {
    expect(resolveImageCandidate(item({}), { tag: 'tag-1', preferBackdrop: true })).toEqual({
      imageType: ImageType.Backdrop,
      imageTag: 'tag-1',
      itemId: 'item-1',
      height: undefined,
    });
  });

  it('prefers item thumb when requested', () => {
    expect(
      resolveImageCandidate(
        item({
          ImageTags: {
            Primary: 'primary-tag',
            Thumb: 'thumb-tag',
          },
        }),
        { preferThumb: true },
      ),
    ).toEqual({
      imageType: ImageType.Thumb,
      imageTag: 'thumb-tag',
      itemId: 'item-1',
      height: undefined,
    });
  });

  it('inherits episode parent backdrop when thumb is preferred and no thumb exists', () => {
    expect(
      resolveImageCandidate(
        item({
          Type: BaseItemKind.Episode,
          ParentBackdropImageTags: ['backdrop-tag'],
          ParentBackdropItemId: 'series-1',
        }),
        { preferThumb: true },
      ),
    ).toEqual({
      imageType: ImageType.Backdrop,
      imageTag: 'backdrop-tag',
      itemId: 'series-1',
      height: undefined,
    });
  });

  it('skips episode primary image when child count is zero', () => {
    expect(
      resolveImageCandidate(
        item({
          Type: BaseItemKind.Episode,
          ChildCount: 0,
          ImageTags: {
            Primary: 'primary-tag',
            Thumb: 'thumb-tag',
          },
        }),
      ),
    ).toEqual({
      imageType: ImageType.Thumb,
      imageTag: 'thumb-tag',
      itemId: 'item-1',
      height: undefined,
    });
  });

  it('calculates primary image height from aspect ratio', () => {
    expect(
      resolveImageCandidate(
        item({
          ImageTags: {
            Primary: 'primary-tag',
          },
          PrimaryImageAspectRatio: 2,
        }),
        { width: 400 },
      ),
    ).toEqual({
      imageType: ImageType.Primary,
      imageTag: 'primary-tag',
      itemId: 'item-1',
      height: 200,
    });
  });
});
