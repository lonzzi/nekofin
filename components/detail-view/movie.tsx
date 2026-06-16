import { useAppTheme } from '@/lib/design-system';
import { MediaItem, MediaPerson } from '@/services/media/types';
import { FlatList, Text, View } from 'react-native';

import { SeriesCard } from '../media/Card';
import { detailViewStyles, ItemInfoList, ItemMeta, ItemOverview, PlayButton } from './common';
import { PersonItem } from './PersonItem';

export const MovieModeContent = ({
  people,
  similarItems,
  item,
}: {
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;

  return (
    <>
      <ItemMeta item={item} />
      {!!item.id && <PlayButton item={item} />}
      <ItemOverview item={item} />
      <ItemInfoList item={item} />

      {people && people.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>演职人员</Text>
          <FlatList
            horizontal
            data={people}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <PersonItem item={item} />}
            keyExtractor={(item) => `${item.id ?? item.name}-${item.role ?? ''}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {similarItems && similarItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>更多类似的</Text>
          <FlatList
            horizontal
            data={similarItems}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <SeriesCard item={item} imgType="Primary" />}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}
    </>
  );
};
