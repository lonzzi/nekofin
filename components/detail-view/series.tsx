import { useAppTheme } from '@/lib/theme';
import { MediaItem, MediaPerson } from '@/services/media/types';
import { FlatList, Text, View } from 'react-native';

import { EpisodeCard, SeriesCard } from '../media/Card';
import { detailViewStyles, ItemInfoList, ItemMeta, ItemOverview } from './common';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';

export const SeriesModeContent = ({
  seasons,
  nextUpItems,
  people,
  similarItems,
  item,
}: {
  seasons: MediaItem[];
  nextUpItems: MediaItem[];
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  return (
    <>
      <ItemMeta item={item} />
      <ItemOverview item={item} />
      <ItemInfoList item={item} />

      {nextUpItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>接下来</Text>
          <FlatList
            horizontal
            removeClippedSubviews={false}
            data={nextUpItems}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => (
              <EpisodeCard item={item} style={detailViewStyles.horizontalCard} imgType="Primary" />
            )}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {seasons && seasons.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>季度</Text>
          <FlatList
            horizontal
            removeClippedSubviews={false}
            data={seasons}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <SeriesCard item={item} imgType="Primary" hideSubtitle />}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      <PeopleSection items={people} />
      <SimilarItemsSection items={similarItems} />
    </>
  );
};
