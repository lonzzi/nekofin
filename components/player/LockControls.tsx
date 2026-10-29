import { useTranslation } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer } from './PlayerContext';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import { useOverlayInsets } from './useOverlayInsets';

export function LockControls() {
  const { t: tr } = useTranslation();
  const { lockFadeAnim, isLocked, onToggleLock, showLockControl } = usePlayer();
  const { side, safeSideGap, bottomExtra } = useOverlayInsets();
  const insets = useSafeAreaInsets();
  const visible = showLockControl;

  return (
    <View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          right: Math.max(side, insets.right + safeSideGap),
          bottom: insets.bottom + (Platform.OS === 'ios' ? 16 : 24) + bottomExtra,
        },
      ]}
    >
      <PlayerGlassSurface
        fadeProgress={lockFadeAnim}
        radius={22}
        style={styles.button}
        visible={visible}
      >
        <Pressable
          accessibilityLabel={isLocked ? tr('player.unlockPlayer') : tr('player.lockPlayer')}
          accessibilityHint={isLocked ? tr('player.unlockPlayerHint') : tr('player.lockPlayerHint')}
          accessibilityRole="button"
          accessibilityState={{ selected: isLocked }}
          hitSlop={6}
          onPress={onToggleLock}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          testID="player-lock-button"
        >
          <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={22} color="#fff" />
        </Pressable>
      </PlayerGlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 30,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  pressed: { opacity: 0.62 },
});
