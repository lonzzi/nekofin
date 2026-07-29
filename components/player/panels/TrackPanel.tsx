import type { MediaTrack, MediaTracks, TrackInfo } from '@/components/player/PlayerContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';

import type { PlayerTrackPanelTab } from './playerPanelRoute';

export type TrackPanelProps = {
  tracks?: MediaTracks;
  selectedTracks?: MediaTrack;
  initialTab?: PlayerTrackPanelTab;
  onAudioTrackChange?: (trackIndex: number) => void;
  onSubtitleTrackChange?: (trackIndex: number) => void;
};

type TrackRowModel = TrackInfo & {
  label: string;
};

type TrackRowProps = TrackRowModel & {
  disabled: boolean;
  selected: boolean;
  onSelect: (trackIndex: number) => void;
};

const ROW_HEIGHT = 54;

const TrackRow = memo(function TrackRow({
  index,
  label,
  language,
  disabled,
  selected,
  onSelect,
}: TrackRowProps) {
  const handlePress = useCallback(() => onSelect(index), [index, onSelect]);
  const detail = language ? language.toUpperCase() : undefined;

  return (
    <Pressable
      accessibilityLabel={[label, detail, selected ? '已选择' : null].filter(Boolean).join('，')}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.trackRow,
        selected && styles.selectedRow,
        pressed && styles.pressedRow,
      ]}
    >
      <View pointerEvents="none" style={styles.trackCopy}>
        <Text numberOfLines={1} style={styles.trackLabel}>
          {label}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={styles.trackDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Ionicons color="#fff" name="checkmark-circle" size={20} /> : null}
    </Pressable>
  );
});

const keyExtractor = (item: TrackRowModel) => String(item.index);
const getItemLayout = (_data: ArrayLike<TrackRowModel> | null | undefined, index: number) => ({
  index,
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
});

export function TrackPanel({
  tracks,
  selectedTracks,
  initialTab = 'subtitle',
  onAudioTrackChange,
  onSubtitleTrackChange,
}: TrackPanelProps) {
  const [activeTab, setActiveTab] = useState<PlayerTrackPanelTab>(initialTab);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const audioTracks = useMemo<TrackRowModel[]>(
    () =>
      (tracks?.audio ?? [])
        .filter((track) => track.index !== -1)
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((track) => ({ ...track, label: track.name || `音轨 ${track.index}` })),
    [tracks?.audio],
  );
  const subtitleTracks = useMemo<TrackRowModel[]>(
    () => [
      { index: -1, name: '关闭字幕', label: '关闭字幕' },
      ...(tracks?.subtitle ?? [])
        .filter((track) => track.index !== -1)
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((track) => ({ ...track, label: track.name || `字幕 ${track.index}` })),
    ],
    [tracks?.subtitle],
  );
  const isSubtitleTab = activeTab === 'subtitle';
  const data = isSubtitleTab ? subtitleTracks : audioTracks;
  const selectedIndex = isSubtitleTab
    ? (selectedTracks?.subtitle?.index ?? -1)
    : selectedTracks?.audio?.index;
  const onSelect = isSubtitleTab ? onSubtitleTrackChange : onAudioTrackChange;

  const handleSelect = useCallback(
    (trackIndex: number) => {
      onSelect?.(trackIndex);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TrackRowModel>) => (
      <TrackRow
        disabled={!onSelect}
        index={item.index}
        label={item.label}
        language={item.language}
        name={item.name}
        onSelect={handleSelect}
        selected={item.index === selectedIndex}
      />
    ),
    [handleSelect, onSelect, selectedIndex],
  );

  return (
    <View style={styles.container} testID="player-track-panel">
      <View accessibilityRole="tablist" style={styles.segmentedControl}>
        <Pressable
          accessibilityLabel={`字幕，共 ${Math.max(subtitleTracks.length - 1, 0)} 条`}
          accessibilityRole="tab"
          accessibilityState={{ selected: isSubtitleTab }}
          onPress={() => setActiveTab('subtitle')}
          style={[styles.segment, isSubtitleTab && styles.activeSegment]}
        >
          <Ionicons color="#fff" name="text-outline" size={17} />
          <Text style={styles.segmentLabel}>字幕</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`音轨，共 ${audioTracks.length} 条`}
          accessibilityRole="tab"
          accessibilityState={{ selected: !isSubtitleTab }}
          onPress={() => setActiveTab('audio')}
          style={[styles.segment, !isSubtitleTab && styles.activeSegment]}
        >
          <Ionicons color="#fff" name="musical-notes-outline" size={17} />
          <Text style={styles.segmentLabel}>音轨</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={[styles.listContent, data.length === 0 && styles.emptyListContent]}
        contentInsetAdjustmentBehavior="never"
        data={data}
        extraData={selectedIndex}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        keyExtractor={keyExtractor}
        ListEmptyComponent={<Text style={styles.emptyText}>暂无可用音轨</Text>}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControl: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 13,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
  },
  activeSegment: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  segmentLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    padding: 24,
    textAlign: 'center',
  },
  trackRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 10,
    height: ROW_HEIGHT,
    paddingHorizontal: 14,
  },
  selectedRow: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  pressedRow: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  trackCopy: {
    flex: 1,
    minWidth: 0,
  },
  trackLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  trackDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
