import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { DandanComment } from '@/services/dandanplay';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MenuView } from '@react-native-menu/menu';
import { useCallback, useRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

import { DanmakuSearchModal, DanmakuSearchModalRef } from './DanmakuSearchModal';
import { usePlayer } from './PlayerContext';

type SettingsButtonsProps = {
  style?: StyleProp<ViewStyle>;
};

export function SettingsButtons({ style }: SettingsButtonsProps) {
  const {
    tracks,
    selectedTracks,
    onAudioTrackChange,
    onSubtitleTrackChange,
    onRateChange,
    rate,
    setMenuOpen,
    onCommentsLoaded,
  } = usePlayer();

  const danmakuSearchModalRef = useRef<DanmakuSearchModalRef>(null);
  const { settings: danmakuSettings, setSettings: setDanmakuSettings } = useDanmakuSettings();

  const audioTracks =
    tracks?.audio?.filter((track) => track.index !== -1).sort((a, b) => a.index - b.index) ?? [];
  const subtitleTracks =
    tracks?.subtitle?.filter((track) => track.index !== -1).sort((a, b) => a.index - b.index) ?? [];

  const handleAudioTrackSelect = (trackIndex: number) => {
    onAudioTrackChange?.(trackIndex);
  };

  const handleSubtitleTrackSelect = (trackIndex: number) => {
    onSubtitleTrackChange?.(trackIndex);
  };

  const handleRateSelect = (newRate: number) => {
    onRateChange?.(newRate);
  };

  const handleDanmakuToggle = useCallback(() => {
    setDanmakuSettings({
      ...danmakuSettings,
      danmakuFilter: danmakuSettings.danmakuFilter === 15 ? 0 : 15,
    });
  }, [danmakuSettings, setDanmakuSettings]);

  const handleDanmakuSearch = useCallback(() => {
    danmakuSearchModalRef.current?.present();
  }, []);

  const handleCommentsLoaded = useCallback(
    (comments: DandanComment[], episodeInfo?: { animeTitle: string; episodeTitle: string }) => {
      onCommentsLoaded?.(comments, episodeInfo);
    },
    [onCommentsLoaded],
  );

  const createMenuAction = <T,>(id: string, title: string, currentValue: T, targetValue: T) => ({
    id,
    title,
    state: currentValue === targetValue ? ('on' as const) : ('off' as const),
  });

  const createRateAction = (rateValue: number) =>
    createMenuAction(`rate_${rateValue}`, `${rateValue}x`, rate, rateValue);

  return (
    <View style={[styles.row, style]}>
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('audio_')) {
            const trackIndex = parseInt(key.replace('audio_', ''));
            handleAudioTrackSelect(trackIndex);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="音轨选择"
        actions={
          audioTracks.length > 0
            ? audioTracks.map((track) =>
                createMenuAction(
                  `audio_${track.index}`,
                  track.name,
                  selectedTracks?.audio?.index,
                  track.index,
                ),
              )
            : [{ id: 'no_audio', title: '无可用音轨', state: 'off' as const }]
        }
      >
        <TouchableOpacity style={styles.circleButton} disabled={audioTracks.length === 0}>
          <MaterialIcons
            name="audiotrack"
            size={20}
            color={audioTracks.length === 0 ? '#666' : 'white'}
          />
        </TouchableOpacity>
      </MenuView>

      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('subtitle_')) {
            const trackIndex = parseInt(key.replace('subtitle_', ''));
            handleSubtitleTrackSelect(trackIndex);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="字幕选择"
        actions={
          subtitleTracks.length > 0
            ? [
                createMenuAction('subtitle_-1', '关闭字幕', selectedTracks?.subtitle?.index, -1),
                ...subtitleTracks.map((track) =>
                  createMenuAction(
                    `subtitle_${track.index}`,
                    track.name,
                    selectedTracks?.subtitle?.index,
                    track.index,
                  ),
                ),
              ]
            : [{ id: 'no_subtitle', title: '无可用字幕', state: 'off' as const }]
        }
      >
        <TouchableOpacity style={styles.circleButton} disabled={subtitleTracks.length === 0}>
          <MaterialIcons
            name="subtitles"
            size={20}
            color={subtitleTracks.length === 0 ? '#666' : 'white'}
          />
        </TouchableOpacity>
      </MenuView>

      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('rate_')) {
            const newRate = parseFloat(key.replace('rate_', ''));
            handleRateSelect(newRate);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="播放速度"
        actions={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(createRateAction)}
      >
        <TouchableOpacity style={styles.circleButton}>
          <MaterialIcons name="speed" size={20} color="white" />
        </TouchableOpacity>
      </MenuView>

      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key === 'danmaku_toggle') {
            handleDanmakuToggle();
          } else if (key === 'danmaku_search') {
            handleDanmakuSearch();
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="弹幕设置"
        actions={[
          createMenuAction(
            'danmaku_toggle',
            danmakuSettings.danmakuFilter === 15 ? '开启弹幕' : '关闭弹幕',
            danmakuSettings.danmakuFilter,
            15,
          ),
          { id: 'danmaku_search', title: '搜索弹幕', state: 'off' },
        ]}
      >
        <TouchableOpacity style={styles.circleButton}>
          <MaterialIcons name="chat" size={20} color="white" />
        </TouchableOpacity>
      </MenuView>

      <DanmakuSearchModal ref={danmakuSearchModalRef} onCommentsLoaded={handleCommentsLoaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
