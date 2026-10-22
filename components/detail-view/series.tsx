import { getMediaRailListConfig } from '@/components/media/railPerformanceConfig';
import { useContentDimensions, useLargeContentLayout } from '@/hooks/useContentDimensions';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { MediaItem, MediaPerson } from '@/services/media/types';
import { FlatList, Platform, Text, View } from 'react-native';

import { EpisodeCard, SeriesCard } from '../media/Card';
import { detailViewStyles, ItemInfoList, ItemMeta, ItemOverview } from './common';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import { DetailSummary } from './DetailSummary';

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
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const { width } = useContentDimensions();
  const railBatching = (cardWidth: number) =>
    Platform.OS === 'android'
      ? getMediaRailListConfig({
          cardWidth,
          gap: theme.spacing.md,
          horizontalPadding: theme.spacing.page + theme.spacing.sm,
          viewportWidth: width,
        })
      : {};
  const tablet = useLargeContentLayout();
  return (
    <>
      <DetailSummary
        item={item}
        metadata={<ItemMeta item={item} />}
        overview={<ItemOverview item={item} />}
      >
        {!tablet ? <ItemInfoList item={item} /> : null}
      </DetailSummary>

      {nextUpItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>
            {tr('home.upNext')}
          </Text>
          <FlatList
            {...railBatching(theme.layout.mediaRail.episodeCardWidth - theme.spacing.xl)}
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
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>
            {tr('media.seasonNumber')}
          </Text>
          <FlatList
            {...railBatching(theme.layout.mediaRail.posterCardWidth)}
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

      {tablet ? <ItemInfoList item={item} /> : null}

      <PeopleSection items={people} />
      <SimilarItemsSection items={similarItems} />
    </>
  );
};
