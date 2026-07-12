import { getHomeRailListConfig } from '@/components/home/homePerformanceConfig';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { SkeletonUserViewCard } from '../ui/Skeleton';
import { UserViewCard } from './UserViewCard';

const skeletonKeyExtractor = (_: unknown, index: number) => `skeleton-${index}`;
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
  const { width: viewportWidth } = useWindowDimensions();
  const userViewItems = userView || [];
  const listPerformanceConfig = useMemo(
    () =>
      getHomeRailListConfig({
        gap: theme.spacing.md,
        horizontalPadding: theme.spacing.page,
        type: 'userView',
        viewportWidth,
      }),
    [theme.spacing.md, theme.spacing.page, viewportWidth],
  );
  const skeletonItems = useMemo(
    () => Array.from({ length: listPerformanceConfig.initialNumToRender }),
    [listPerformanceConfig.initialNumToRender],
  );

  const renderItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <UserViewCard item={item} title={item.name || '未知标题'} />,
    [],
  );

  const renderSkeletonItem = useCallback(() => <SkeletonUserViewCard />, []);

  if (isLoading) {
    return (
      <View>
        <FlatList
          {...listPerformanceConfig}
          data={skeletonItems}
          horizontal
          keyExtractor={skeletonKeyExtractor}
          removeClippedSubviews={false}
          showsHorizontalScrollIndicator={false}
          style={styles.userViewList}
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
        {...listPerformanceConfig}
        data={userViewItems}
        horizontal
        keyExtractor={itemKeyExtractor}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        style={styles.userViewList}
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
  userViewList: {
    marginBottom: -8,
    overflow: 'visible',
  },
  userViewContainer: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 26,
    overflow: 'visible',
  },
  userViewContent: {
    marginBottom: 2,
    textAlign: 'center',
  },
  userViewTitle: {
    flex: 1,
  },
});
