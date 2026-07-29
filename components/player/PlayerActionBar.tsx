import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView, type MenuComponentRef, type NativeActionEvent } from '@react-native-menu/menu';
import {
  useCallback,
  useMemo,
  useRef,
  type ComponentProps,
  type ComponentType,
  type RefAttributes,
} from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { usePlayer } from './PlayerContext';
import { derivePlayerActionButtons, type PlayerActionButtonKey } from './playerControlModel';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import {
  deriveDanmakuMenuActions,
  derivePlaybackMenuActions,
  deriveTrackMenuActions,
  parsePlayerMenuAction,
} from './playerMenuModel';

const icons: Record<PlayerActionButtonKey, keyof typeof Ionicons.glyphMap> = {
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

const androidMenuAccessibilityActions: NonNullable<ViewProps['accessibilityActions']> = [
  { name: 'activate', label: '打开菜单' },
];

const AccessibleMenuView = MenuView as ComponentType<
  AccessibleMenuViewProps & RefAttributes<MenuComponentRef>
>;

function PlayerMenu(props: PlayerMenuProps) {
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
      accessibilityActions={Platform.OS === 'android' ? androidMenuAccessibilityActions : undefined}
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
};

function ActionButton({
  accessible = true,
  accessibilityLabel,
  actionKey,
  danmakuEnabled,
  onPress,
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
        <Ionicons name={icons[actionKey]} size={18} color="#fff" />
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
  const {
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
  } = usePlayer();
  const { settings, setSettings } = useDanmakuSettings();
  const actions = useMemo(
    () =>
      derivePlayerActionButtons({
        danmakuCount: danmakuComments.length,
        episodeCount: episodes.length,
        isMovie,
      }),
    [danmakuComments.length, episodes.length, isMovie],
  );
  const danmakuMenuActions = useMemo(
    () =>
      deriveDanmakuMenuActions({
        commentCount: danmakuComments.length,
        enabled: settings.enabled,
      }),
    [danmakuComments.length, settings.enabled],
  );
  const trackMenuActions = useMemo(
    () => deriveTrackMenuActions(tracks, selectedTracks),
    [selectedTracks, tracks],
  );
  const playbackMenuActions = useMemo(
    () => derivePlaybackMenuActions(rate, aspectRatio),
    [aspectRatio, rate],
  );

  const handleDanmakuAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      switch (selection?.kind) {
        case 'danmakuToggle':
          setSettings({ ...settings, enabled: !settings.enabled });
          break;
        case 'danmakuSettings':
          openPanel({ key: 'danmaku' });
          break;
        case 'danmakuSearch':
          openPanel({ key: 'danmakuSearch' });
          break;
      }
    },
    [openPanel, setSettings, settings],
  );
  const handleTrackAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      if (selection?.kind === 'audioTrack') {
        onAudioTrackChange?.(selection.trackIndex);
      } else if (selection?.kind === 'subtitleTrack') {
        onSubtitleTrackChange?.(selection.trackIndex);
      }
    },
    [onAudioTrackChange, onSubtitleTrackChange],
  );
  const handlePlaybackAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      const selection = parsePlayerMenuAction(nativeEvent.event);
      if (selection?.kind === 'rate') {
        onRateChange?.(selection.rate);
      } else if (selection?.kind === 'aspectRatio') {
        onAspectRatioChange?.(selection.aspectRatio);
      }
    },
    [onAspectRatioChange, onRateChange],
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
            action.key === 'danmaku'
              ? `${action.accessibilityLabel}，${settings.enabled ? '已开启' : '已关闭'}`
              : action.key === 'playback' && rate !== 1
                ? `${action.accessibilityLabel}，当前 ${rate} 倍速`
                : action.accessibilityLabel;
          const actionButton = (
            <ActionButton
              accessible={action.key === 'episodes'}
              accessibilityLabel={accessibilityLabel}
              actionKey={action.key}
              danmakuEnabled={settings.enabled}
              onPress={action.key === 'episodes' ? handleEpisodesPress : undefined}
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
                  title="弹幕"
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
                  title="字幕与音轨"
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
                  title="播放设置"
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
  menuAnchor: {
    backgroundColor: 'transparent',
    height: 46,
    width: 44,
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
