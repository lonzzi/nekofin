import { useThemeColor } from '@/hooks/useThemeColor';
import { MediaSource } from '@/services/media/types';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { detailViewStyles } from './common';
import { getAudioInfoRows, getVideoInfoRows, MediaInfoRow } from './episodeMediaInfo';

const MediaInfoCard = ({ rows, title }: { rows: MediaInfoRow[]; title: string }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const bgColor = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');

  if (rows.length === 0) return null;

  return (
    <View style={[styles.infoCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
      <View style={styles.infoGrid}>
        {rows.map((row) => (
          <View key={`${row.label}-${row.value}`} style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>{row.label}</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{row.value}</Text>
          </View>
        ))}
      </View>
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
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

  if (mediaSources.length === 0) return null;

  return (
    <View style={detailViewStyles.sectionBlock}>
      <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>媒体信息</Text>
      <FlatList
        horizontal
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
  infoCard: {
    width: 240,
    minHeight: 400,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
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
    fontSize: 12,
    minWidth: 60,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
