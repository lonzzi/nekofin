import { MediaItem, MediaPerson } from '@/services/media/types';

import { ItemInfoList, ItemMeta, ItemOverview, PlayButton } from './common';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';

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
      {!!item.id && <PlayButton item={item} />}
      <ItemOverview item={item} />
      <ItemInfoList item={item} />

      <PeopleSection items={people} />
      <SimilarItemsSection items={similarItems} />
    </>
  );
};
