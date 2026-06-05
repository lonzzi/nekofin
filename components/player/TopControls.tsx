import { formatBitrate, sleep } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Network from 'expo-network';
import { useNetworkState } from 'expo-network';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DanmakuSearchModal, DanmakuSearchModalRef } from './DanmakuSearchModal';
import { usePlayer } from './PlayerContext';
import { useOverlayInsets } from './useOverlayInsets';

export function TopControls() {
  const { side, topExtra } = useOverlayInsets();
  const insets = useSafeAreaInsets();

  const {
    title,
    showControls,
    setShowControls,
    fadeAnim,
    mediaStats,
    onCommentsLoaded,
    danmakuEpisodeInfo,
    danmakuComments,
  } = usePlayer();

  const router = useRouter();
  const navigation = useNavigation();
  const [now, setNow] = useState<string>('');
  const { type: networkType } = useNetworkState();
  const danmakuSearchModalRef = useRef<DanmakuSearchModalRef>(null);

  const fadeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = `${d.getHours()}`.padStart(2, '0');
      const m = `${d.getMinutes()}`.padStart(2, '0');
      setNow(`${h}:${m}`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const handleBackPress = async () => {
    setShowControls(false);
    navigation.setOptions({
      orientation: 'portrait',
    });
    await sleep(Platform.OS === 'ios' ? 300 : 0);
    router.back();
  };

  const handleCommentsLoaded = useCallback(
    (comments: DandanComment[], episodeInfo?: { animeTitle: string; episodeTitle: string }) => {
      onCommentsLoaded?.(comments, episodeInfo);
    },
    [onCommentsLoaded],
  );

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: side,
            right: side,
            top: insets.top + 10 + topExtra,
            zIndex: 10,
          },
          fadeAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={{ position: 'absolute', top: 40 }}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <Pressable style={styles.backButtonTouchable} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
        </View>

        <View style={styles.netRow}>
          {networkType === Network.NetworkStateType.WIFI && (
            <Ionicons name="wifi" size={14} color="#fff" />
          )}
          {networkType === Network.NetworkStateType.CELLULAR && (
            <Ionicons name="cellular" size={14} color="#fff" />
          )}
          {networkType === Network.NetworkStateType.ETHERNET && (
            <Ionicons name="link" size={14} color="#fff" />
          )}
          {(networkType === Network.NetworkStateType.NONE ||
            networkType === Network.NetworkStateType.UNKNOWN) && (
            <Ionicons name="unlink" size={14} color="#fff" />
          )}
          {!!mediaStats?.inputBitrate && mediaStats.inputBitrate > 0 && (
            <Text style={[styles.textShadow, styles.netSpeedText]}>
              {formatBitrate(mediaStats.inputBitrate, { unit: 'bytes' })}
            </Text>
          )}
        </View>

        <View
          style={{
            position: 'absolute',
            top: 22,
            left: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {danmakuEpisodeInfo && (
            <View style={styles.danmakuInfoRow}>
              <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
              <Text style={[styles.textShadow, styles.danmakuInfoText]}>
                {danmakuEpisodeInfo.animeTitle} - {danmakuEpisodeInfo.episodeTitle}
              </Text>
            </View>
          )}
          {danmakuComments.length > 0 && (
            <Text style={[styles.textShadow, styles.danmakuCountText]}>
              {danmakuComments.length} 条弹幕
            </Text>
          )}
        </View>

        {!!now && (
          <View style={{ position: 'absolute', top: 0, right: 0 }}>
            <Text style={[styles.textShadow, styles.clockText]}>{now}</Text>
          </View>
        )}

        {!!title && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={[styles.textShadow, styles.title]} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
          </View>
        )}
      </Animated.View>

      <DanmakuSearchModal ref={danmakuSearchModalRef} onCommentsLoaded={handleCommentsLoaded} />
    </>
  );
}

const styles = StyleSheet.create({
  textShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netSpeedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'left',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  backButtonTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  danmakuInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  danmakuInfoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'left',
  },
  danmakuCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'left',
    opacity: 0.8,
  },
});
