import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { t as tr, useTranslation } from '@/lib/i18n';
import { layout, useAppTheme } from '@/lib/theme';
import { mediaSourcesQueryOptions } from '@/services/media/queryOptions';
import { MediaSource } from '@/services/media/types';
import { Button, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../ui/EmptyState';
import { InfoCard, InfoCardPlaceholderRows, InfoCardRows } from '../ui/InfoCard';
import { detailViewStyles } from './common';
import {
  getAudioInfoRows,
  getMediaInfoDisplayState,
  getVideoInfoRows,
  MediaInfoRow,
} from './episodeMediaInfo';

const MediaInfoCard = ({ rows, title }: { rows?: MediaInfoRow[]; title: string }) => {
  if (rows?.length === 0) return null;

  return (
    <InfoCard title={title} variant="media">
      {rows ? <InfoCardRows rows={rows} /> : <InfoCardPlaceholderRows count={10} />}
    </InfoCard>
  );
};

export const SourceMediaInfoCard = ({ source }: { source: MediaSource }) => (
  <View style={styles.sourceCardContainer}>
    <MediaInfoCard title={tr('media.video')} rows={getVideoInfoRows(source)} />
    <MediaInfoCard title={tr('media.audio')} rows={getAudioInfoRows(source)} />
  </View>
);

export function EpisodeMediaInfoList({ episodeId }: { episodeId: string }) {
  const adapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const mediaSources = useQueryWithFocus(
    mediaSourcesQueryOptions({ adapter, currentServer, itemId: episodeId }),
  );
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const textColor = theme.colors.text;

  const sources = mediaSources.data?.mediaSources ?? [];
  const displayState = getMediaInfoDisplayState({
    mediaSources: sources,
    isPending: mediaSources.isPending,
    isError: mediaSources.isError,
  });

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>
        {tr('media.information')}
      </Text>
      {displayState === 'ready' ? (
        <FlatList
          horizontal
          removeClippedSubviews={false}
          data={sources}
          style={[detailViewStyles.edgeToEdge, styles.mediaInfoList]}
          renderItem={({ item }) => <SourceMediaInfoCard source={item} />}
          keyExtractor={(item, index) => item.id || `source-${index}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={detailViewStyles.horizontalList}
        />
      ) : displayState === 'loading' ? (
        <View
          accessible
          accessibilityLabel={tr('media.loadingInformation')}
          accessibilityState={{ busy: true }}
          pointerEvents="none"
        >
          <ScrollView
            horizontal
            scrollEnabled={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[detailViewStyles.edgeToEdge, styles.mediaInfoList]}
            contentContainerStyle={detailViewStyles.horizontalList}
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.sourceCardContainer}>
              <MediaInfoCard title={tr('media.video')} />
              <MediaInfoCard title={tr('media.audio')} />
            </View>
          </ScrollView>
        </View>
      ) : (
        <View>
          <EmptyState
            title={
              displayState === 'error'
                ? tr('media.informationLoadFailed')
                : tr('media.noInformation')
            }
            description={
              displayState === 'error'
                ? tr('search.checkNetworkAndRetry')
                : tr('media.episodeTracksUnavailable')
            }
          />
          {displayState === 'error' ? (
            <Button
              title={tr('common.retry')}
              onPress={() => void mediaSources.refetch()}
              color={theme.colors.tint}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaInfoList: {
    minHeight: layout.mediaInfoCard.minHeight,
  },
  sourceCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
});
