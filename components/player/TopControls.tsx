import { formatBitrate, sleep } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import * as Network from 'expo-network';
import { useNetworkState } from 'expo-network';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { DanmakuSearchModal, DanmakuSearchModalRef } from './DanmakuSearchModal';
import { usePlayer } from './PlayerContext';
import { useOverlayInsets } from './useOverlayInsets';

export function TopControls() {
  const { side, topExtra } = useOverlayInsets();

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
    await sleep(Platform.OS === 'ios' ? 100 : 0);
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
          { top: 50 + topExtra, left: side, position: 'absolute', zIndex: 10 },
          fadeAnimatedStyle,
        ]}
        pointerEvents={showControls ? 'auto' : 'none'}
      >
        <BlurView tint="dark" intensity={100} style={styles.backButtonBlur}>
          <TouchableOpacity style={styles.backButtonTouchable} onPress={handleBackPress}>
            <AntDesign name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', top: 10 + topExtra, left: side, zIndex: 10 },
          fadeAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.View style={styles.netRow}>
          {networkType === Network.NetworkStateType.WIFI && (
            <MaterialIcons name="wifi" size={14} color="#fff" />
          )}
          {networkType === Network.NetworkStateType.CELLULAR && (
            <MaterialIcons name="network-cell" size={14} color="#fff" />
          )}
          {networkType === Network.NetworkStateType.ETHERNET && (
            <MaterialIcons name="settings-ethernet" size={14} color="#fff" />
          )}
          {(networkType === Network.NetworkStateType.NONE ||
            networkType === Network.NetworkStateType.UNKNOWN) && (
            <MaterialIcons name="signal-cellular-off" size={14} color="#fff" />
          )}
          {!!mediaStats?.inputBitrate && mediaStats.inputBitrate > 0 && (
            <Text style={[styles.textShadow, styles.netSpeedText]}>
              {formatBitrate(mediaStats.inputBitrate)}
            </Text>
          )}
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 32 + topExtra,
            left: side,
            zIndex: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2,
          },
          fadeAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        {danmakuEpisodeInfo && (
          <View style={styles.danmakuInfoRow}>
            <MaterialIcons name="chat" size={12} color="#fff" />
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
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', top: 10 + topExtra, right: side, zIndex: 10 },
          fadeAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        {!!now && <Text style={[styles.textShadow, styles.clockText]}>{now}</Text>}
      </Animated.View>

      {!!title && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 10 + topExtra,
              left: side,
              right: side,
              alignItems: 'center',
              zIndex: 10,
            },
            fadeAnimatedStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.textShadow, styles.title]} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
        </Animated.View>
      )}

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
