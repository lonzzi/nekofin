import { MediaItem, MediaPerson } from '@/services/media/types';

import { ItemInfoList, ItemMeta, ItemOverview } from './common';
import { DeferredDetailSections } from './DeferredDetailSections';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import { DetailPlaybackControls } from './DetailPlaybackControls';
import { DetailSummary } from './DetailSummary';

export const MovieModeContent = ({
  people,
  similarItems,
  item,
}: {
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  return (
    <>
      <DetailSummary
        item={item}
        metadata={<ItemMeta item={item} />}
        controls={item.id ? <DetailPlaybackControls item={item} /> : null}
        overview={<ItemOverview item={item} />}
      >
        <ItemInfoList item={item} />
      </DetailSummary>

      <DeferredDetailSections>
        <PeopleSection items={people} />
        <SimilarItemsSection items={similarItems} />
      </DeferredDetailSections>
    </>
  );
};
