import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import PageScrollView from '@/components/PageScrollView';
import { SkeletonHorizontalSection } from '@/components/ui/Skeleton';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import {
  recommendedSearchItemsQueryOptions,
  searchItemsQueryOptions,
} from '@/services/media/queryOptions';
import { MediaItem } from '@/services/media/types';
import { useNavigation } from 'expo-router';
import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  TextInputChangeEvent,
  View,
} from 'react-native';
import { SearchBarCommands } from 'react-native-screens';

export default function ServerSearchScreen() {
  const { currentServer } = useMediaServers();
  const [keyword, setKeyword] = useState<string>('');
  const [selected, setSelected] = useState<string>('');
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;

  const navigation = useNavigation();

  const searchBarRef = useRef<SearchBarCommands>(null);

  const { data: recommendedData = [] } = useQueryWithFocus(
    recommendedSearchItemsQueryOptions({
      adapter: mediaAdapter,
      currentServer,
    }),
  );

  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const effectiveKeyword = useMemo(
    () => selected || debouncedKeyword,
    [selected, debouncedKeyword],
  );

  const {
    data: results = [],
    isLoading: loadingResults,
    isError: isResultsError,
    refetch,
  } = useQueryWithFocus(
    searchItemsQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      keyword: effectiveKeyword,
    }),
  );

  const groupedResults = useMemo(() => {
    const typeToItems: Record<string, MediaItem[]> = {};
    results.forEach((item) => {
      const key = item.type || 'Other';
      if (!typeToItems[key]) typeToItems[key] = [];
      typeToItems[key].push(item);
    });
    const order = ['Series', 'Movie', 'Episode', 'MusicVideo', 'Other'];
    const titleMap: Record<string, string> = {
      Series: '剧集',
      Movie: '电影',
      Episode: '单集',
      MusicVideo: '音乐视频',
      Other: '其他',
    };
    const entries = Object.entries(typeToItems);
    entries.sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0])),
    );
    return entries.map(([type, items]) => ({ key: type, title: titleMap[type] || type, items }));
  }, [results]);

  const renderItem: ListRenderItem<MediaItem> = useCallback(({ item }) => {
    if (item.type === 'Series') {
      return <SeriesCard item={item} />;
    }
    return <EpisodeCard item={item} />;
  }, []);

  const keyExtractor = useCallback((item: MediaItem) => item.id!, []);
  const itemSeparator = useCallback(
    () => <View style={{ width: theme.spacing.lg }} />,
    [theme.spacing.lg],
  );

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        ref: searchBarRef as RefObject<SearchBarCommands>,
        placeholder: currentServer?.name
          ? `搜索 ${currentServer.name} 中的影片、剧集`
          : '搜索影片、剧集',
        onChangeText: (t: TextInputChangeEvent) => {
          const text = t.nativeEvent.text;
          if (text.length === 0) {
            setSelected('');
          }
          setKeyword(text);
        },
        onCancelButtonPress: () => {
          setKeyword('');
          setSelected('');
        },
        hideWhenScrolling: false,
        cancelButtonText: '取消',
      },
    });
  }, [currentServer?.name, navigation, searchBarRef]);

  if (effectiveKeyword.length === 0) {
    return <ItemGridScreen title="推荐" data={recommendedData} type="series" disableGrouping />;
  }

  return (
    <PageScrollView style={[styles.container, { backgroundColor }]}>
      {loadingResults && <SkeletonHorizontalSection title="加载中" />}

      {groupedResults.length === 0 && !loadingResults && (
        <View style={styles.emptyContainer}>
          <Text
            style={[
              theme.typography.footnote,
              styles.emptyText,
              { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
            ]}
          >
            没有找到相关内容
          </Text>
          {isResultsError && (
            <Pressable
              style={[
                styles.retryButton,
                {
                  borderColor: theme.colors.tint,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
              onPress={() => refetch()}
            >
              <Text
                style={[theme.typography.footnote, styles.retryText, { color: theme.colors.tint }]}
              >
                重试
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {groupedResults.map((group) => (
        <View key={group.key} style={{ paddingTop: theme.spacing.sm }}>
          <Text
            style={[
              theme.typography.bodyEmphasized,
              styles.sectionTitle,
              {
                color: theme.colors.text,
                marginBottom: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
              },
            ]}
          >
            {group.title}
          </Text>
          <FlatList
            data={group.items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            }}
            ItemSeparatorComponent={itemSeparator}
          />
        </View>
      ))}
    </PageScrollView>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = React.useState<string>(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {},
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {},
  retryButton: {
    borderWidth: 1,
  },
  retryText: {
    fontWeight: '600',
  },
});
