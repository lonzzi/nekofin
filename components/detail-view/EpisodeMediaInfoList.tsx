import { layout, useAppTheme } from '@/lib/theme';
import { MediaSource } from '@/services/media/types';
import { Host, RNHostView } from '@expo/ui/swift-ui';
import { blur } from '@expo/ui/swift-ui/modifiers';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../ui/EmptyState';
import { ShadowedGlassCard } from '../ui/GlassCard';
import { detailViewStyles } from './common';
import {
  getAudioInfoRows,
  getMediaInfoDisplayState,
  getVideoInfoRows,
  MediaInfoRow,
} from './episodeMediaInfo';

const SKELETON_ROWS = Array.from({ length: 10 }, (_, index) => index);

const MediaInfoCard = ({ rows, title }: { rows: MediaInfoRow[]; title: string }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const subtitleColor = theme.colors.textSecondary;

  if (rows.length === 0) return null;

  return (
    <ShadowedGlassCard
      radius={16}
      containerStyle={styles.infoCardShadow}
      style={styles.infoCard}
      surface="material"
    >
      <Text style={[theme.typography.footnote, styles.cardTitle, { color: textColor }]}>
        {title}
      </Text>
      <View style={styles.infoGrid}>
        {rows.map((row) => (
          <View key={`${row.label}-${row.value}`} style={styles.infoRow}>
            <Text style={[theme.typography.caption, styles.infoLabel, { color: subtitleColor }]}>
              {row.label}
            </Text>
            <Text style={[theme.typography.caption, styles.infoValue, { color: textColor }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </ShadowedGlassCard>
  );
};

export const SourceMediaInfoCard = ({ source }: { source: MediaSource }) => (
  <View style={styles.sourceCardContainer}>
    <MediaInfoCard title="视频" rows={getVideoInfoRows(source)} />
    <MediaInfoCard title="音频" rows={getAudioInfoRows(source)} />
  </View>
);

function MediaInfoSkeletonRows() {
  const theme = useAppTheme();
  const rowHeight = theme.typography.caption.lineHeight;
  const content = (
    <View style={[styles.infoGrid, styles.skeletonContent]}>
      {SKELETON_ROWS.map((index) => (
        <View key={index} style={[styles.infoRow, { height: rowHeight }]}>
          <View
            style={[
              styles.skeletonBar,
              styles.infoLabel,
              { backgroundColor: theme.colors.textSecondary },
            ]}
          />
          <View style={styles.infoValue}>
            <View
              style={[
                styles.skeletonBar,
                {
                  width: index % 2 === 0 ? '90%' : '65%',
                  backgroundColor: theme.colors.textSecondary,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <Host
        style={{
          width: '100%',
          height:
            SKELETON_ROWS.length * rowHeight + (SKELETON_ROWS.length - 1) * styles.infoGrid.gap,
        }}
        colorScheme={theme.colorScheme}
        modifiers={[blur(3)]}
        pointerEvents="none"
      >
        <RNHostView>{content}</RNHostView>
      </Host>
    );
  }

  return <View style={styles.skeletonBlur}>{content}</View>;
}

function MediaInfoSkeleton() {
  const theme = useAppTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="正在加载媒体信息"
      accessibilityState={{ busy: true }}
    >
      <View
        style={styles.sourceCardContainer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {['视频', '音频'].map((title) => (
          <ShadowedGlassCard
            key={title}
            radius={16}
            containerStyle={styles.infoCardShadow}
            style={styles.infoCard}
            surface="material"
          >
            <Text
              style={[theme.typography.footnote, styles.cardTitle, { color: theme.colors.text }]}
            >
              {title}
            </Text>
            <MediaInfoSkeletonRows />
          </ShadowedGlassCard>
        ))}
      </View>
    </View>
  );
}

export const EpisodeMediaInfoList = ({
  mediaSources,
  isPending = false,
  isError = false,
}: {
  mediaSources: MediaSource[];
  isPending?: boolean;
  isError?: boolean;
}) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;

  const displayState = getMediaInfoDisplayState({ mediaSources, isPending, isError });

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>媒体信息</Text>
      <FlatList
        horizontal
        removeClippedSubviews={false}
        data={displayState === 'ready' ? mediaSources : []}
        style={[detailViewStyles.edgeToEdge, styles.mediaInfoList]}
        renderItem={({ item }) => <SourceMediaInfoCard source={item} />}
        keyExtractor={(item, index) => item.id || `source-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={detailViewStyles.horizontalList}
        ListEmptyComponent={
          displayState === 'loading' ? (
            <MediaInfoSkeleton />
          ) : (
            <View style={styles.emptyCard}>
              <EmptyState
                title={displayState === 'error' ? '媒体信息加载失败' : '暂无媒体信息'}
                description={
                  displayState === 'error' ? '请稍后重试' : '服务器未提供这集的音视频信息'
                }
              />
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mediaInfoList: {
    minHeight: layout.mediaInfoCard.minHeight,
  },
  emptyCard: {
    width: layout.mediaInfoCard.width,
    minHeight: layout.mediaInfoCard.minHeight,
  },
  sourceCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCardShadow: {
    width: layout.mediaInfoCard.width,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
  },
  infoCard: {
    minHeight: layout.mediaInfoCard.minHeight,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  infoGrid: {
    gap: 6,
  },
  skeletonContent: {
    opacity: 0.4,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 3,
  },
  skeletonBlur: {
    filter: [{ blur: 3 }],
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoLabel: {
    minWidth: 60,
  },
  infoValue: {
    fontWeight: '500',
    flex: 1,
  },
});
