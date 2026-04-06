import { useThemeColor } from '@/hooks/useThemeColor';
import { MediaItem } from '@/services/media/types';
import React, { useCallback } from 'react';
import { FlatList, ListRenderItem, StyleSheet, Text, View } from 'react-native';

import { SkeletonUserViewCard } from '../ui/Skeleton';
import { UserViewCard } from './UserViewCard';

const skeletonData = Array.from({ length: 3 });
const skeletonKeyExtractor = (_: unknown, index: number) => `skeleton-${index}`;
const renderSkeletonItem = () => <SkeletonUserViewCard />;
const itemKeyExtractor = (item: MediaItem, index: number) =>
  item.id ? String(item.id) : String(index);

export const UserViewSection = React.memo(function UserViewSection({
  userView,
  isLoading,
  title,
}: {
  userView: MediaItem[];
  isLoading?: boolean;
  title?: string;
}) {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const userViewItems = userView || [];

  const renderItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <UserViewCard item={item} title={item.name || '未知标题'} />,
    [],
  );

  if (isLoading) {
    return (
      <View>
        <FlatList
          data={skeletonData}
          horizontal
          keyExtractor={skeletonKeyExtractor}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.userViewContainer}
          renderItem={renderSkeletonItem}
        />
      </View>
    );
  }

  if (userViewItems.length === 0) {
    return (
      <View>
        <Text style={styles.userViewContent}>暂无内容</Text>
      </View>
    );
  }

  return (
    <View>
      {title && <Text style={[styles.userViewTitle, { color: textColor }]}>{title}</Text>}
      <FlatList
        data={userViewItems}
        horizontal
        keyExtractor={itemKeyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.userViewContainer}
        renderItem={renderItem}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  userViewContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  userViewContent: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  userViewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    paddingHorizontal: 20,
    marginRight: 12,
    marginBottom: 12,
  },
});
