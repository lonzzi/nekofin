import Ionicons from '@expo/vector-icons/Ionicons';
import type { MediaInfo } from 'expo-mpv';
import { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { derivePlaybackInfoBadges, derivePlaybackInfoSummary } from './playbackInfo';
import { usePlayer } from './PlayerContext';
import { PlayerGlassSurface } from './PlayerGlassSurface';

export function PlaybackInfoBadges() {
  const {
    playbackSourceInfo,
    readPlaybackMediaInfo,
    showControls,
    fadeAnim,
    clearControlsTimeout,
    hideControlsWithDelay,
  } = usePlayer();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [sample, setSample] = useState<{
    reader: typeof readPlaybackMediaInfo;
    info: MediaInfo;
  } | null>(null);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!showControls || !foreground || !readPlaybackMediaInfo) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const info = await readPlaybackMediaInfo();
        if (!cancelled && info)
          setSample((previous) =>
            previous?.reader === readPlaybackMediaInfo &&
            JSON.stringify(previous.info) === JSON.stringify(info)
              ? previous
              : { reader: readPlaybackMediaInfo, info },
          );
      } catch {
        /* Optional diagnostics must not interrupt playback. */
      }
      if (!cancelled) timeout = setTimeout(refresh, 1000);
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [showControls, foreground, readPlaybackMediaInfo]);
  if (!playbackSourceInfo) return null;
  const info = sample?.reader === readPlaybackMediaInfo ? sample?.info : null;
  const badges = derivePlaybackInfoBadges(playbackSourceInfo, info);
  const summary = derivePlaybackInfoSummary(badges);
  const showDetails = () => {
    clearControlsTimeout();
    Alert.alert(
      '播放信息',
      badges.map((badge) => badge.accessibilityLabel).join('\n'),
      [{ text: '完成', onPress: hideControlsWithDelay }],
      { cancelable: true, onDismiss: hideControlsWithDelay },
    );
  };
  return (
    <PlayerGlassSurface fadeProgress={fadeAnim} visible={showControls} style={styles.surface}>
      <Pressable
        accessible={showControls}
        accessibilityElementsHidden={!showControls}
        importantForAccessibility={showControls ? 'auto' : 'no-hide-descendants'}
        accessibilityRole="button"
        accessibilityLabel={summary.map((badge) => badge.accessibilityLabel).join('，')}
        accessibilityHint="查看完整播放信息"
        onPress={showDetails}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        testID="player-playback-info"
      >
        {summary.map((badge, index) => (
          <View key={badge.key} style={styles.field}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {badge.key === 'method' ? (
              <Ionicons name="server-outline" color="rgba(255,255,255,0.8)" size={12} />
            ) : null}
            <Text maxFontSizeMultiplier={1.4} style={styles.text}>
              {badge.text}
            </Text>
          </View>
        ))}
        <Ionicons name="information-circle-outline" color="rgba(255,255,255,0.65)" size={14} />
      </Pressable>
    </PlayerGlassSurface>
  );
}
const styles = StyleSheet.create({
  surface: { alignSelf: 'flex-start', maxWidth: '100%' },
  row: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  field: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  separator: { width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  pressed: { opacity: 0.7 },
  text: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
