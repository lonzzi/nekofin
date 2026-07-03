import { useAppTheme } from '@/lib/theme';
import { MediaSource } from '@/services/media/types';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ShadowedGlassCard } from '../ui/GlassCard';
import { detailViewStyles } from './common';
import { getAudioInfoRows, getVideoInfoRows, MediaInfoRow } from './episodeMediaInfo';

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
      disableLiquidGlass
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

export const EpisodeMediaInfoList = ({ mediaSources }: { mediaSources: MediaSource[] }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;

  if (mediaSources.length === 0) return null;

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>媒体信息</Text>
      <FlatList
        horizontal
        removeClippedSubviews={false}
        data={mediaSources}
        style={detailViewStyles.edgeToEdge}
        renderItem={({ item }) => <SourceMediaInfoCard source={item} />}
        keyExtractor={(item, index) => item.id || `source-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={detailViewStyles.horizontalList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sourceCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCardShadow: {
    width: 240,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
  },
  infoCard: {
    minHeight: 380,
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
