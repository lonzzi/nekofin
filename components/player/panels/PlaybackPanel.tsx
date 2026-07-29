import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useMemo } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';

export type PlaybackPanelProps = {
  rate: number;
  aspectRatio?: string;
  onRateChange?: (rate: number) => void;
  onAspectRatioChange?: (aspectRatio: string) => void;
};

type PlaybackOption = {
  key: string;
  kind: 'rate' | 'aspect';
  label: string;
  value: number | string;
};

type PlaybackSection = {
  title: string;
  data: PlaybackOption[];
};

type PlaybackOptionRowProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
};

const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const sections: PlaybackSection[] = [
  {
    title: '播放速度',
    data: rates.map((rate) => ({
      key: `rate_${rate}`,
      kind: 'rate',
      label: rate === 1 ? '正常' : `${rate}×`,
      value: rate,
    })),
  },
  {
    title: '画面比例',
    data: [
      { key: 'aspect_fit', kind: 'aspect', label: '自适应', value: 'fit' },
      { key: 'aspect_fill', kind: 'aspect', label: '铺满屏幕', value: 'fill' },
      { key: 'aspect_16:9', kind: 'aspect', label: '16:9', value: '16:9' },
      { key: 'aspect_4:3', kind: 'aspect', label: '4:3', value: '4:3' },
    ],
  },
];

const PlaybackOptionRow = memo(function PlaybackOptionRow({
  label,
  selected,
  disabled,
  onPress,
}: PlaybackOptionRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${label}${selected ? '，已选择' : ''}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.selectedRow,
        pressed && styles.pressedRow,
      ]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      {selected ? <Ionicons color="#fff" name="checkmark-circle" size={20} /> : null}
    </Pressable>
  );
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
}

const keyExtractor = (item: PlaybackOption) => item.key;

export function PlaybackPanel({
  rate,
  aspectRatio = 'fit',
  onRateChange,
  onAspectRatioChange,
}: PlaybackPanelProps) {
  const selectionSignature = `${rate}:${aspectRatio}`;
  const sectionData = useMemo(() => sections, []);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<PlaybackOption, PlaybackSection>) => {
      const isRate = item.kind === 'rate';
      const selected = isRate ? rate === item.value : aspectRatio === item.value;
      const disabled = isRate ? !onRateChange : !onAspectRatioChange;
      const handlePress = () => {
        if (isRate) {
          onRateChange?.(Number(item.value));
        } else {
          onAspectRatioChange?.(String(item.value));
        }
      };

      return (
        <PlaybackOptionRow
          disabled={disabled}
          label={item.label}
          onPress={handlePress}
          selected={selected}
        />
      );
    },
    [aspectRatio, onAspectRatioChange, onRateChange, rate],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: PlaybackSection }) => <SectionHeader title={section.title} />,
    [],
  );

  return (
    <SectionList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="never"
      extraData={selectionSignature}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      sections={sectionData}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      testID="player-playback-panel"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    backgroundColor: 'transparent',
    paddingBottom: 7,
    paddingHorizontal: 6,
    paddingTop: 18,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  optionRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 13,
    flexDirection: 'row',
    height: 52,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  selectedRow: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  pressedRow: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
});
