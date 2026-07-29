import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlayer } from './PlayerContext';
import { derivePlayerActionButtons, type PlayerActionButtonKey } from './playerControlModel';
import { PlayerGlassSurface } from './PlayerGlassSurface';

const icons: Record<PlayerActionButtonKey, keyof typeof Ionicons.glyphMap> = {
  episodes: 'albums-outline',
  danmaku: 'chatbubble-ellipses-outline',
  tracks: 'text-outline',
  playback: 'options-outline',
};

export function PlayerActionBar() {
  const { danmakuComments, episodes, fadeAnim, isMovie, openPanel, rate, showControls } =
    usePlayer();
  const { settings } = useDanmakuSettings();
  const actions = useMemo(
    () =>
      derivePlayerActionButtons({
        danmakuCount: danmakuComments.length,
        episodeCount: episodes.length,
        isMovie,
      }),
    [danmakuComments.length, episodes.length, isMovie],
  );

  const handlePress = (key: PlayerActionButtonKey) => {
    switch (key) {
      case 'episodes':
        openPanel({ key: 'episodes' });
        break;
      case 'danmaku':
        openPanel({ key: 'danmaku' });
        break;
      case 'tracks':
        openPanel({ key: 'tracks' });
        break;
      case 'playback':
        openPanel({ key: 'playback' });
        break;
    }
  };

  return (
    <PlayerGlassSurface
      contentStyle={styles.content}
      fadeProgress={fadeAnim}
      radius={24}
      style={styles.surface}
      surfaceStyle={styles.surfaceInner}
      visible={showControls}
    >
      <View style={styles.row}>
        {actions.map((action, index) => {
          const isDanmaku = action.key === 'danmaku';
          const accessibilityLabel = isDanmaku
            ? `${action.accessibilityLabel}，${settings.enabled ? '已开启' : '已关闭'}`
            : action.key === 'playback' && rate !== 1
              ? `${action.accessibilityLabel}，当前 ${rate} 倍速`
              : action.accessibilityLabel;

          return (
            <View key={action.key} style={styles.itemGroup}>
              {index > 0 && <View style={styles.separator} />}
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                onPress={() => handlePress(action.key)}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={icons[action.key]} size={18} color="#fff" />
                  {isDanmaku && (
                    <View
                      accessibilityElementsHidden
                      style={[styles.statusDot, settings.enabled && styles.statusDotEnabled]}
                    />
                  )}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </PlayerGlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: 46,
  },
  surfaceInner: {
    minHeight: 46,
  },
  content: {
    height: 46,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 46,
    paddingHorizontal: 4,
  },
  itemGroup: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  separator: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: 18,
    width: StyleSheet.hairlineWidth,
  },
  button: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    width: 44,
  },
  iconWrap: {
    position: 'relative',
  },
  statusDot: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderColor: 'rgba(14,16,20,0.9)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 7,
    position: 'absolute',
    right: -3,
    top: -2,
    width: 7,
  },
  statusDotEnabled: {
    backgroundColor: '#64D2FF',
  },
  pressed: {
    opacity: 0.58,
  },
});
