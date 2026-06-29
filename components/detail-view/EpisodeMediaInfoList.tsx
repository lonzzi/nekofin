import { useAppTheme } from '@/lib/design-system';
import { MediaSource } from '@/services/media/types';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { detailViewStyles } from './common';
import { getAudioInfoRows, getVideoInfoRows, MediaInfoRow } from './episodeMediaInfo';

const MediaInfoCard = ({ rows, title }: { rows: MediaInfoRow[]; title: string }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const subtitleColor = theme.colors.textSecondary;
  const useLiquidGlass = isLiquidGlassAvailable();

  if (rows.length === 0) return null;

  return (
    <View style={styles.infoCardShadow}>
      <GlassView
        style={[styles.infoCard, !useLiquidGlass && { backgroundColor: theme.colors.surface }]}
        glassEffectStyle="regular"
        tintColor="rgba(255,255,255,0.10)"
      >
        <View pointerEvents="none" style={styles.infoCardRim} />
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
      </GlassView>
    </View>
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
    borderRadius: 16,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  infoCard: {
    width: '100%',
    minHeight: 380,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: 12,
    gap: 8,
  },
  infoCardRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.66)',
    backgroundColor: 'rgba(255,255,255,0.03)',
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
