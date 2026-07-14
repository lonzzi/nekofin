import { useAppTheme } from '@/lib/theme';
import type { MediaItem, MediaPerson } from '@/services/media/types';
import { memo } from 'react';
import { FlatList, Text, View, type ListRenderItemInfo } from 'react-native';

import { SeriesCard } from '../media/Card';
import { detailViewStyles } from './common';
import { PersonItem } from './PersonItem';

function renderPerson({ item }: ListRenderItemInfo<MediaPerson>) {
  return <PersonItem item={item} />;
}

function getPersonKey(item: MediaPerson) {
  return `${item.id ?? item.name}-${item.role ?? item.type ?? ''}`;
}

function renderSimilarItem({ item }: ListRenderItemInfo<MediaItem>) {
  return <SeriesCard item={item} imgType="Primary" />;
}

function getMediaItemKey(item: MediaItem) {
  return item.id ?? `${item.type ?? 'media'}-${item.name ?? 'untitled'}`;
}

export const PeopleSection = memo(function PeopleSection({ items }: { items: MediaPerson[] }) {
  const theme = useAppTheme();
  if (items.length === 0) return null;

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: theme.colors.text }]}>演职人员</Text>
      <FlatList
        horizontal
        removeClippedSubviews={false}
        data={items}
        style={detailViewStyles.edgeToEdge}
        renderItem={renderPerson}
        keyExtractor={getPersonKey}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={detailViewStyles.horizontalList}
      />
    </View>
  );
});

export const SimilarItemsSection = memo(function SimilarItemsSection({
  items,
}: {
  items: MediaItem[];
}) {
  const theme = useAppTheme();
  if (items.length === 0) return null;

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: theme.colors.text }]}>更多类似的</Text>
      <FlatList
        horizontal
        removeClippedSubviews={false}
        data={items}
        style={detailViewStyles.edgeToEdge}
        renderItem={renderSimilarItem}
        keyExtractor={getMediaItemKey}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={detailViewStyles.horizontalList}
      />
    </View>
  );
});
