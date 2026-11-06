import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { getMediaGridListConfig } from '@/components/media/gridPerformanceConfig';
import type { MediaItemSource } from '@/components/media/mediaSource';
import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { emptyListContentStyle, EmptyListViewport } from '@/components/ui/EmptyListViewport';
import { EmptyState, type EmptyStateProps } from '@/components/ui/EmptyState';
import { FilterChoice, FilterRow } from '@/components/ui/FilterControls';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import type { MediaItem } from '@/services/media/types';
import { memo, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItem,
} from 'react-native';

import {
  createSearchResultSections,
  type SearchMediaFilter,
  type SearchResultGroup,
  type SearchResultRow,
  type SearchResultSection,
} from './searchResultSections';

const EMPTY_GROUPS: SearchResultGroup[] = [];
const FILTERS = [
  { value: 'all', title: 'common.all' },
  { value: 'Movie', title: 'media.movies' },
  { value: 'Series', title: 'media.series' },
  { value: 'Episode', title: 'media.episodes' },
] as const;

const SearchCardRow = memo(function SearchCardRow({
  items,
  source,
  cardType,
  cardWidth,
  gap,
}: {
  items: MediaItem[];
  source: MediaItemSource;
  cardType: SearchResultSection['cardType'];
  cardWidth: number;
  gap: number;
}) {
  const cardStyle = useMemo(() => ({ width: cardWidth }), [cardWidth]);
  const Card = cardType === 'series' ? SeriesCard : EpisodeCard;
  return (
    <View style={[styles.cardRow, { gap, paddingBottom: gap }]}>
      {items.map((item) => (
        <Card
          key={item.id}
          item={item}
          source={source}
          showServerSource={false}
          style={cardStyle}
        />
      ))}
    </View>
  );
});

export function SearchResultsGrid({
  groups,
  filter,
  onFilterChange,
  state,
  pendingServerCount = 0,
  notice,
  emptyState,
}: {
  groups: SearchResultGroup[];
  filter: SearchMediaFilter;
  onFilterChange: (filter: SearchMediaFilter) => void;
  state: 'idle' | 'loading' | 'ready';
  pendingServerCount?: number;
  notice?: string;
  emptyState: EmptyStateProps;
}) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const viewport = useContentDimensions();
  const tabBarInset = useFloatingTabBarInset();
  const poster = useGridLayout('series', 160);
  const episode = useGridLayout('episode');
  const visibleGroups = state === 'ready' ? groups : EMPTY_GROUPS;
  const sections = useMemo(
    () =>
      createSearchResultSections({
        groups: visibleGroups,
        filter,
        posterColumns: poster.numColumns,
        episodeColumns: episode.numColumns,
        translate: tr,
      }),
    [visibleGroups, filter, poster.numColumns, episode.numColumns, tr],
  );
  const count = sections.reduce(
    (total, section) => total + section.data.reduce((sum, row) => sum + row.items.length, 0),
    0,
  );
  const isEmpty = sections.length === 0;
  const rowHeight = Math.max(poster.itemWidth * 1.5, episode.itemWidth * (9 / 16)) + 72;
  const renderItem: SectionListRenderItem<SearchResultRow, SearchResultSection> = useCallback(
    ({ item, section }) => (
      <SearchCardRow
        items={item.items}
        source={section.source}
        cardType={section.cardType}
        cardWidth={section.cardType === 'series' ? poster.itemWidth : episode.itemWidth}
        gap={poster.gap}
      />
    ),
    [poster.itemWidth, poster.gap, episode.itemWidth],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: SearchResultSection }) =>
      section.showServerTitle || section.showTypeTitle ? (
        <View style={[styles.sectionHeader, { paddingTop: theme.spacing.md }]}>
          {section.showServerTitle ? (
            <View style={styles.serverHeading}>
              <Text
                accessibilityRole="header"
                numberOfLines={2}
                style={[theme.typography.title3, styles.serverName, { color: theme.colors.text }]}
              >
                {section.source.server.name}
              </Text>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {tr('search.resultCount', { count: section.serverResultCount })}
              </Text>
            </View>
          ) : null}
          {section.showTypeTitle ? (
            <Text
              accessibilityRole="header"
              style={[theme.typography.bodyEmphasized, { color: theme.colors.textSecondary }]}
            >
              {section.title}
            </Text>
          ) : null}
        </View>
      ) : null,
    [theme, tr],
  );

  return (
    <SectionList<SearchResultRow, SearchResultSection>
      {...getMediaGridListConfig({
        viewportHeight: viewport.height,
        rowHeight,
        numColumns: Math.max(poster.numColumns, episode.numColumns),
      })}
      sections={sections}
      keyExtractor={rowKeyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={false}
      removeClippedSubviews={false}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.list,
        { paddingHorizontal: theme.spacing.page, paddingBottom: tabBarInset + theme.spacing.xl },
        isEmpty && emptyListContentStyle,
      ]}
      ListHeaderComponentStyle={isEmpty ? styles.emptyHeader : undefined}
      ListHeaderComponent={
        <View style={isEmpty ? styles.emptyHeader : undefined}>
          <View style={[styles.filters, { paddingBottom: theme.spacing.md }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterRow>
                {FILTERS.map(({ value, title }) => (
                  <FilterChoice
                    key={value}
                    label={tr(title)}
                    active={filter === value}
                    onPress={() => onFilterChange(value)}
                  />
                ))}
              </FilterRow>
            </ScrollView>
            {state === 'ready' && notice ? (
              <Text
                accessibilityRole="alert"
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {notice}
              </Text>
            ) : null}
            {state === 'ready' && (!isEmpty || pendingServerCount === 0) ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {tr('search.resultCount', { count })}
              </Text>
            ) : null}
            {state === 'ready' && !isEmpty && pendingServerCount > 0 ? (
              <View style={styles.searchProgress}>
                <ActivityIndicator size="small" color={theme.colors.tint} />
                <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                  {tr('search.searchingServers', { count: pendingServerCount })}
                </Text>
              </View>
            ) : null}
          </View>
          {isEmpty ? (
            <EmptyListViewport bottomSpacing={theme.spacing.xl}>
              {state === 'loading' || pendingServerCount > 0 ? (
                <ActivityIndicator
                  color={theme.colors.tint}
                  accessibilityLabel={tr('common.loading')}
                />
              ) : (
                <EmptyState {...emptyState} />
              )}
            </EmptyListViewport>
          ) : null}
        </View>
      }
    />
  );
}

const rowKeyExtractor = (row: SearchResultRow) => row.key;
const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingTop: 8 },
  emptyHeader: { flex: 1 },
  filters: { gap: 12 },
  searchProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeader: { gap: 10, paddingBottom: 12 },
  serverHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serverName: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
