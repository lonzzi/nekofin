import { MenuView, type MenuComponentRef, type NativeActionEvent } from '@/components/ui/MenuView';
import { usePlayerGestureSettings } from '@/hooks/usePlayerGestureSettings';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useTranslation } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { playbackQualityOptions } from '@/services/media/playbackQuality';
import { visibleChapters } from '@/services/media/segments';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useCallback,
  useMemo,
  useRef,
  type ComponentProps,
  type ComponentType,
  type RefAttributes,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useMMKVBoolean } from 'react-native-mmkv';

import { usePlayer } from './PlayerContext';
import { derivePlayerActionButtons, type PlayerActionButtonKey } from './playerControlModel';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import {
  deriveAutoSkipMenuActions,
  deriveChapterMenuAction,
  deriveDanmakuMenuActions,
  derivePlaybackMenuActions,
  deriveQualityMenuActions,
  deriveTrackMenuActions,
  parsePlayerMenuAction,
} from './playerMenuModel';

const icons: Record<Exclude<PlayerActionButtonKey, 'quality'>, keyof typeof Ionicons.glyphMap> = {
  episodes: 'albums-outline',
  danmaku: 'chatbubble-ellipses-outline',
  tracks: 'text-outline',
  playback: 'options-outline',
};

type PlayerMenuProps = Omit<ComponentProps<typeof MenuView>, 'ref'> & {
  accessibilityLabel: string;
  accessibilityRole: 'button';
};

type AccessibleMenuViewProps = PlayerMenuProps &
  Pick<ViewProps, 'accessibilityActions' | 'onAccessibilityAction'>;

const AccessibleMenuView = MenuView as ComponentType<
  AccessibleMenuViewProps & RefAttributes<MenuComponentRef>
>;

function PlayerMenu(props: PlayerMenuProps) {
  const { t: tr } = useTranslation();
  const menuRef = useRef<MenuComponentRef>(null);
  const handleAccessibilityAction = useCallback<NonNullable<ViewProps['onAccessibilityAction']>>(
    (event) => {
      if (event.nativeEvent.actionName === 'activate') menuRef.current?.show();
    },
    [],
  );

  // MenuView forwards native View props, but its public type omits accessibility props.
  return (
    <AccessibleMenuView
      {...props}
      accessibilityActions={
        Platform.OS === 'android' ? [{ name: 'activate', label: tr('common.openMenu') }] : undefined
      }
      onAccessibilityAction={Platform.OS === 'android' ? handleAccessibilityAction : undefined}
      ref={menuRef}
    />
  );
}

type ActionButtonProps = {
  accessible?: boolean;
  accessibilityLabel: string;
  actionKey: PlayerActionButtonKey;
  danmakuEnabled?: boolean;
  onPress?: () => void;
  qualityLabel?: string;
};

function ActionButton({
  accessible = true,
  accessibilityLabel,
  actionKey,
  danmakuEnabled,
  onPress,
  qualityLabel = 'AUTO',
}: ActionButtonProps) {
  return (
    <Pressable
      accessible={accessible}
      accessibilityElementsHidden={!accessible}
      accessibilityLabel={accessible ? accessibilityLabel : undefined}
      accessibilityRole={accessible ? 'button' : undefined}
      importantForAccessibility={accessible ? 'auto' : 'no-hide-descendants'}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        {actionKey === 'quality' ? (
          <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.qualityText}>
            {qualityLabel}
          </Text>
        ) : (
          <Ionicons name={icons[actionKey]} size={18} color="#fff" />
        )}
        {actionKey === 'danmaku' ? (
          <View
            accessibilityElementsHidden
            style={[styles.statusDot, danmakuEnabled ? styles.statusDotEnabled : null]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function PlayerActionBar() {
  const { t: tr } = useTranslation();
  const {
    currentItem,
    duration,
    canSeek,
    onSeek,
    aspectRatio,
    clearControlsTimeout,
    danmakuComments,
    episodes,
    fadeAnim,
    hideControlsWithDelay,
    isMovie,
    onAspectRatioChange,
    onAudioTrackChange,
    onRateChange,
    onSubtitleTrackChange,
    openPanel,
    rate,
    selectedTracks,
    showControls,
    tracks,
    mediaSources,
    selectedMediaSourceId,
    onMediaSourceChange,
    quality = 'auto',
    onQualityChange,
  } = usePlayer();
  const { settings, setSettings } = useDanmakuSettings();
  const [autoSkipIntro = false, setAutoSkipIntro] = useMMKVBoolean(
    'playback.autoSkipIntro',
    storage,
  );
  const [autoSkipOutro = false, setAutoSkipOutro] = useMMKVBoolean(
    'playback.autoSkipOutro',
    storage,
  );
  const {
    brightnessGestureEnabled,
    setBrightnessGestureEnabled,
    volumeGestureEnabled,
    setVolumeGestureEnabled,
    seekGestureEnabled,
    setSeekGestureEnabled,
  } = usePlayerGestureSettings();
  const actions = useMemo(
    () =>
      derivePlayerActionButtons(
        {
          danmakuCount: danmakuComments.length,
          episodeCount: episodes.length,
          isMovie,
        },
        tr,
      ),
    [danmakuComments.length, episodes.length, isMovie, tr],
  );
  const danmakuMenuActions = useMemo(
    () =>
      deriveDanmakuMenuActions(
        {
          commentCount: danmakuComments.length,
          enabled: settings.enabled,
        },
        tr,
      ),
    [danmakuComments.length, settings.enabled, tr],
  );
  const trackMenuActions = useMemo(
    () => deriveTrackMenuActions(tracks, selectedTracks, mediaSources, selectedMediaSourceId, tr),
    [selectedTracks, tracks, mediaSources, selectedMediaSourceId, tr],
  );
  const playbackMenuActions = useMemo(
    () => [
      ...deriveChapterMenuAction(
        visibleChapters(currentItem?.chapters ?? [], duration),
        canSeek,
        tr,
      ),
      ...derivePlaybackMenuActions(rate, aspectRatio, tr, {
        brightnessGestureEnabled,
        volumeGestureEnabled,
        seekGestureEnabled,
      }),
      ...deriveAutoSkipMenuActions({ intro: autoSkipIntro, outro: autoSkipOutro }, tr),
    ],
    [
      aspectRatio,
      rate,
      tr,
      currentItem?.chapters,
      duration,
      canSeek,
      autoSkipIntro,
      autoSkipOutro,
      brightnessGestureEnabled,
      volumeGestureEnabled,
      seekGestureEnabled,
    ],
  );
  const qualityMenuActions = useMemo(() => deriveQualityMenuActions(quality, tr), [quality, tr]);
  const currentQuality =
    playbackQualityOptions.find((option) => option.id === quality) ?? playbackQualityOptions[0];
  const qualityLabel =
    currentQuality.id === 'auto'
      ? 'AUTO'
      : currentQuality.title.replace(' Mbps', 'M').replace(' Kbps', 'K');

  const handleDanmakuAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      switch (selection?.kind) {
        case 'danmakuToggle':
          setSettings((current) => ({ ...current, enabled: !current.enabled }));
          break;
        case 'danmakuSettings':
          openPanel({ key: 'danmaku' });
          break;
        case 'danmakuSearch':
          openPanel({ key: 'danmakuSearch' });
          break;
      }
    },
    [openPanel, setSettings],
  );
  const handleTrackAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      if (selection?.kind === 'audioTrack') {
        onAudioTrackChange?.(selection.trackIndex);
      } else if (selection?.kind === 'subtitleTrack') {
        onSubtitleTrackChange?.(selection.trackIndex);
      } else if (selection?.kind === 'mediaSource') {
        onMediaSourceChange?.(selection.id);
      }
    },
    [onAudioTrackChange, onSubtitleTrackChange, onMediaSourceChange],
  );
  const handlePlaybackAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      if (selection?.kind === 'rate') {
        onRateChange?.(selection.rate);
      } else if (selection?.kind === 'aspectRatio') {
        onAspectRatioChange?.(selection.aspectRatio);
      } else if (selection?.kind === 'chapter' && canSeek && duration > 0) {
        onSeek(selection.timeMs / duration);
      } else if (selection?.kind === 'autoSkipIntro') {
        setAutoSkipIntro((current) => !current);
      } else if (selection?.kind === 'autoSkipOutro') {
        setAutoSkipOutro((current) => !current);
      } else if (selection?.kind === 'brightnessGestureToggle') {
        setBrightnessGestureEnabled((enabled) => !(enabled ?? true));
      } else if (selection?.kind === 'volumeGestureToggle') {
        setVolumeGestureEnabled((enabled) => !(enabled ?? true));
      } else if (selection?.kind === 'seekGestureToggle') {
        setSeekGestureEnabled((enabled) => !(enabled ?? true));
      }
    },
    [
      onAspectRatioChange,
      onRateChange,
      canSeek,
      duration,
      onSeek,
      setAutoSkipIntro,
      setAutoSkipOutro,
      setBrightnessGestureEnabled,
      setVolumeGestureEnabled,
      setSeekGestureEnabled,
    ],
  );
  const handleQualityAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      if (selection?.kind === 'quality') onQualityChange?.(selection.quality);
    },
    [onQualityChange],
  );
  const handleEpisodesPress = useCallback(() => {
    openPanel({ key: 'episodes' });
  }, [openPanel]);

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
          const accessibilityLabel =
            action.key === 'quality'
              ? tr('player.qualityValue', {
                  value: currentQuality.id === 'auto' ? tr('common.auto') : currentQuality.title,
                })
              : action.key === 'danmaku'
                ? `${action.accessibilityLabel}，${settings.enabled ? tr('settings.enabled') : tr('settings.disabled')}`
                : action.key === 'playback' && rate !== 1
                  ? tr('player.speedAccessibilityLabel', {
                      accessibilityLabel: action.accessibilityLabel,
                      rate: rate,
                    })
                  : action.accessibilityLabel;
          const actionButton = (
            <ActionButton
              accessible={action.key === 'episodes'}
              accessibilityLabel={accessibilityLabel}
              actionKey={action.key}
              danmakuEnabled={settings.enabled}
              onPress={action.key === 'episodes' ? handleEpisodesPress : undefined}
              qualityLabel={qualityLabel}
            />
          );

          return (
            <View key={action.key} style={styles.itemGroup}>
              {index > 0 ? <View style={styles.separator} /> : null}
              {action.key === 'episodes' ? (
                actionButton
              ) : action.key === 'danmaku' ? (
                <PlayerMenu
                  accessibilityLabel={accessibilityLabel}
                  accessibilityRole="button"
                  actions={danmakuMenuActions}
                  isAnchoredToRight
                  onCloseMenu={hideControlsWithDelay}
                  onOpenMenu={clearControlsTimeout}
                  onPressAction={handleDanmakuAction}
                  shouldOpenOnLongPress={false}
                  style={styles.menuAnchor}
                  testID="player-danmaku-menu"
                  themeVariant="dark"
                  title={tr('danmaku.comments')}
                >
                  {actionButton}
                </PlayerMenu>
              ) : action.key === 'tracks' ? (
                <PlayerMenu
                  accessibilityLabel={accessibilityLabel}
                  accessibilityRole="button"
                  actions={trackMenuActions}
                  isAnchoredToRight
                  onCloseMenu={hideControlsWithDelay}
                  onOpenMenu={clearControlsTimeout}
                  onPressAction={handleTrackAction}
                  shouldOpenOnLongPress={false}
                  style={styles.menuAnchor}
                  testID="player-track-menu"
                  themeVariant="dark"
                  title={tr('player.subtitlesAndAudio')}
                >
                  {actionButton}
                </PlayerMenu>
              ) : action.key === 'quality' ? (
                <PlayerMenu
                  accessibilityLabel={accessibilityLabel}
                  accessibilityRole="button"
                  actions={qualityMenuActions}
                  isAnchoredToRight
                  onCloseMenu={hideControlsWithDelay}
                  onOpenMenu={clearControlsTimeout}
                  onPressAction={handleQualityAction}
                  shouldOpenOnLongPress={false}
                  style={styles.menuAnchor}
                  testID="player-quality-menu"
                  themeVariant="dark"
                  title={tr('player.quality')}
                >
                  {actionButton}
                </PlayerMenu>
              ) : (
                <PlayerMenu
                  accessibilityLabel={accessibilityLabel}
                  accessibilityRole="button"
                  actions={playbackMenuActions}
                  isAnchoredToRight
                  onCloseMenu={hideControlsWithDelay}
                  onOpenMenu={clearControlsTimeout}
                  onPressAction={handlePlaybackAction}
                  shouldOpenOnLongPress={false}
                  style={styles.menuAnchor}
                  testID="player-playback-menu"
                  themeVariant="dark"
                  title={tr('player.settings')}
                >
                  {actionButton}
                </PlayerMenu>
              )}
            </View>
          );
        })}
      </View>
    </PlayerGlassSurface>
  );
}

const styles = StyleSheet.create({
  qualityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  surface: {
    height: 44,
  },
  surfaceInner: {
    minHeight: 44,
  },
  content: {
    height: 44,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 4,
  },
  itemGroup: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  menuAnchor: {
    backgroundColor: 'transparent',
    height: 44,
    width: 44,
  },
  separator: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: 18,
    width: StyleSheet.hairlineWidth,
  },
  button: {
    alignItems: 'center',
    height: 44,
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
