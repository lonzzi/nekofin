import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { formatBitrate } from '@/lib/utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Network from 'expo-network';
import { useNetworkState } from 'expo-network';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer } from './PlayerContext';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import { useOverlayInsets } from './useOverlayInsets';

const networkIcons: Partial<Record<Network.NetworkStateType, keyof typeof Ionicons.glyphMap>> = {
  [Network.NetworkStateType.WIFI]: 'wifi',
  [Network.NetworkStateType.CELLULAR]: 'cellular',
  [Network.NetworkStateType.ETHERNET]: 'link',
  [Network.NetworkStateType.NONE]: 'cloud-offline-outline',
  [Network.NetworkStateType.UNKNOWN]: 'cloud-offline-outline',
  [Network.NetworkStateType.BLUETOOTH]: 'bluetooth',
  [Network.NetworkStateType.VPN]: 'shield-checkmark-outline',
  [Network.NetworkStateType.WIMAX]: 'radio-outline',
  [Network.NetworkStateType.OTHER]: 'ellipsis-horizontal',
};

export function TopControls() {
  const { side, topExtra, maxContentWidth, isCompact } = useOverlayInsets();
  const insets = useSafeAreaInsets();
  const {
    currentItem,
    danmakuComments,
    fadeAnim,
    hdrState,
    mediaStats,
    setShowControls,
    showControls,
    title,
  } = usePlayer();
  const router = useTracedRouter('player-top-controls');
  const { type: networkType } = useNetworkState();
  const [now, setNow] = useState('');

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  useEffect(() => {
    const update = () => {
      const date = new Date();
      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      setNow(`${hours}:${minutes}`);
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleBackPress = () => {
    setShowControls(false);
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/(servers)');
  };

  const hdrLabel = hdrState?.isHdr ? (hdrState.hdrFormat === 'hlg' ? 'HLG' : 'HDR') : null;
  const networkIcon = networkType ? networkIcons[networkType] : undefined;
  const episodeLabel =
    currentItem?.parentIndexNumber != null && currentItem.indexNumber != null
      ? `S${currentItem.parentIndexNumber} E${currentItem.indexNumber}`
      : null;
  const contextLabel = [
    currentItem?.seriesName,
    episodeLabel,
    danmakuComments.length > 0 ? `${danmakuComments.length} 条弹幕` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const primaryTitle = currentItem?.name || title;
  const statusLabel = [
    networkType ? `网络 ${networkType}` : null,
    hdrLabel,
    mediaStats?.inputBitrate ? formatBitrate(mediaStats.inputBitrate, { unit: 'bytes' }) : null,
    now,
  ]
    .filter(Boolean)
    .join('，');
  const leftInset = Math.max(side, insets.left + 8);
  const rightInset = Math.max(side, insets.right + 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { left: leftInset, right: rightInset, top: insets.top + 10 + topExtra },
      ]}
    >
      <View pointerEvents="box-none" style={[styles.content, { maxWidth: maxContentWidth }]}>
        <PlayerGlassSurface
          contentStyle={styles.backButtonContent}
          fadeProgress={fadeAnim}
          radius={22}
          style={styles.backButtonSurface}
          surfaceStyle={styles.backButtonSurfaceInner}
          visible={showControls}
        >
          <Pressable
            accessibilityLabel="返回"
            accessibilityRole="button"
            hitSlop={6}
            onPress={handleBackPress}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        </PlayerGlassSurface>

        <Animated.View style={[styles.titleBlock, fadeAnimatedStyle]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {primaryTitle}
          </Text>
          {!!contextLabel && (
            <Text style={styles.context} numberOfLines={1} ellipsizeMode="tail">
              {contextLabel}
            </Text>
          )}
        </Animated.View>

        <Animated.View
          accessible
          accessibilityLabel={statusLabel}
          pointerEvents="none"
          style={[styles.statusRow, fadeAnimatedStyle]}
        >
          {!!networkIcon && <Ionicons name={networkIcon} size={14} color="#fff" />}
          {!isCompact && !!mediaStats?.inputBitrate && mediaStats.inputBitrate > 0 && (
            <Text style={styles.statusText}>
              {formatBitrate(mediaStats.inputBitrate, { unit: 'bytes' })}
            </Text>
          )}
          {!!hdrLabel && (
            <View style={[styles.hdrBadge, hdrState?.hdrActive && styles.hdrBadgeActive]}>
              <Text style={[styles.hdrText, hdrState?.hdrActive && styles.hdrTextActive]}>
                {hdrLabel}
              </Text>
            </View>
          )}
          {!!now && <Text style={styles.statusText}>{now}</Text>}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  backButtonSurface: {
    height: 44,
    width: 44,
  },
  backButtonSurfaceInner: {
    height: 44,
    width: 44,
  },
  backButtonContent: {
    height: 44,
    width: 44,
  },
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.48)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 5,
  },
  context: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
  },
  statusText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.48)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  hdrBadge: {
    borderColor: 'rgba(255,255,255,0.68)',
    borderCurve: 'continuous',
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  hdrBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(255,255,255,0.92)',
  },
  hdrText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hdrTextActive: {
    color: '#111318',
  },
  pressed: {
    opacity: 0.62,
  },
});
