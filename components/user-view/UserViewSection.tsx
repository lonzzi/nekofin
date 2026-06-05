import { useAppTheme } from '@/lib/design-system';
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
  const theme = useAppTheme();
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
          contentContainerStyle={[
            styles.userViewContainer,
            { gap: theme.spacing.md, paddingHorizontal: theme.spacing.page },
          ]}
          renderItem={renderSkeletonItem}
        />
      </View>
    );
  }

  if (userViewItems.length === 0) {
    return (
      <View style={{ paddingHorizontal: theme.spacing.page }}>
        <Text
          style={[
            theme.typography.footnote,
            styles.userViewContent,
            { color: theme.colors.textSecondary },
          ]}
        >
          暂无内容
        </Text>
      </View>
    );
  }

  return (
    <View>
      {title && (
        <Text
          style={[
            theme.typography.title3,
            styles.userViewTitle,
            {
              color: theme.colors.text,
              marginBottom: theme.spacing.md,
              marginRight: theme.spacing.md,
              paddingHorizontal: theme.spacing.page,
            },
          ]}
        >
          {title}
        </Text>
      )}
      <FlatList
        data={userViewItems}
        horizontal
        keyExtractor={itemKeyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.userViewContainer,
          { gap: theme.spacing.md, paddingHorizontal: theme.spacing.page },
        ]}
        renderItem={renderItem}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  userViewContainer: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  userViewContent: {
    marginBottom: 2,
    textAlign: 'center',
  },
  userViewTitle: {
    flex: 1,
  },
});
