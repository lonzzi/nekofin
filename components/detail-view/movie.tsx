import { MediaItem, MediaPerson } from '@/services/media/types';

import { ItemInfoList, ItemMeta, ItemOverview } from './common';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import { DetailPlaybackControls } from './DetailPlaybackControls';

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
      <ItemMeta item={item} />
      {!!item.id && <DetailPlaybackControls item={item} />}
      <ItemOverview item={item} />
      <ItemInfoList item={item} />

      <PeopleSection items={people} />
      <SimilarItemsSection items={similarItems} />
    </>
  );
};
