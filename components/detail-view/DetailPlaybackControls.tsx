import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { usePlaybackPreferences } from '@/hooks/usePlaybackPreferences';
import { useSubtitlePrefetch } from '@/hooks/useSubtitlePrefetch';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { spacing, useAppTheme } from '@/lib/theme';
import {
  resolvePlaybackSelection,
  type PlaybackSelection,
} from '@/services/media/playbackSelection';
import { mediaSourcesQueryOptions } from '@/services/media/queryOptions';
import type { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView, type MenuComponentRef } from '@react-native-menu/menu';
import { useQuery } from '@tanstack/react-query';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type RefAttributes,
} from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { ShadowedGlassCard } from '../ui/GlassCard';
import { Skeleton } from '../ui/Skeleton';
import { detailViewStyles, PlayButton } from './common';
import { createDetailPlaybackMenu } from './detailPlaybackMenu';

// MenuView forwards View accessibility props; its published type omits them.
const AccessibleMenuView = MenuView as ComponentType<
  ComponentProps<typeof MenuView> & ViewProps & RefAttributes<MenuComponentRef>
>;

export function DetailPlaybackControlsPlaceholder() {
  return (
    <View style={styles.row}>
      <View style={styles.playButton}>
        <Skeleton
          tone="subtle"
          height="auto"
          borderRadius={999}
          style={detailViewStyles.playButtonPressable}
        />
      </View>
      <Skeleton
        tone="subtle"
        width={styles.menuAnchor.width}
        height={styles.menuAnchor.height}
        borderRadius={styles.menuAnchor.borderRadius}
      />
    </View>
  );
}

export function DetailPlaybackControls({ item }: { item: MediaItem }) {
  // Remount when changing episodes so an earlier episode's indices cannot leak.
  return <ItemPlaybackControls key={item.id} item={item} />;
}

function ItemPlaybackControls({ item }: { item: MediaItem }) {
  const theme = useAppTheme();
  const useLiquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const adapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const query = useQuery(mediaSourcesQueryOptions({ adapter, currentServer, itemId: item.id }));
  const sources = query.data?.mediaSources ?? [];
  const [choice, setChoice] = useState<PlaybackSelection>({});
  const preferences = usePlaybackPreferences();
  const selected = resolvePlaybackSelection(sources, choice, preferences);
  useSubtitlePrefetch(
    item.id,
    sources.find((source) => source.id === selected.mediaSourceId),
    selected.subtitleStreamIndex,
  );
  const menu = createDetailPlaybackMenu(
    sources,
    selected,
    Platform.OS === 'android' ? 'android' : 'ios',
  );
  const menuRef = useRef<MenuComponentRef>(null);
  const actions = [
    ...menu.actions.map((action) => ({ ...action, imageColor: theme.colors.text })),
    ...(query.isError
      ? [{ id: 'retry', title: '重新读取播放选项' }]
      : !menu.actions.length
        ? [
            {
              title: query.isPending ? '正在读取播放选项…' : '暂无可用播放选项',
              attributes: { disabled: true },
            },
          ]
        : []),
  ];

  return (
    <View style={styles.row}>
      <PlayButton item={item} selection={selected} containerStyle={styles.playButton} />
      <ShadowedGlassCard
        radius={23}
        containerStyle={styles.menuAnchor}
        style={[styles.optionsSurface, useLiquidGlass && styles.optionsGlassSurface]}
        fallbackBackgroundColor={theme.colors.surface}
        tintColor={`${theme.colors.tint}18`}
        isInteractive
        useGlassEffect
      >
        <AccessibleMenuView
          ref={menuRef}
          testID="detail-playback-options"
          accessibilityRole="button"
          accessibilityLabel="播放选项"
          accessibilityHint="选择可用的视频版本、音轨、字幕和画质"
          accessibilityState={{ busy: query.isPending }}
          accessibilityActions={
            Platform.OS === 'android' ? [{ name: 'activate', label: '打开播放选项' }] : undefined
          }
          onAccessibilityAction={
            Platform.OS === 'android'
              ? ({ nativeEvent }) => {
                  if (nativeEvent.actionName === 'activate') menuRef.current?.show();
                }
              : undefined
          }
          title="播放选项"
          actions={actions}
          style={styles.optionsMenu}
          themeVariant={theme.colorScheme}
          isAnchoredToRight
          shouldOpenOnLongPress={false}
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === 'retry') {
              void query.refetch();
              return;
            }
            const selection = menu.selections.get(nativeEvent.event);
            if (selection) setChoice(selection);
          }}
        >
          <View accessible={false} style={styles.optionsButton}>
            {query.isPending ? (
              <ActivityIndicator size="small" color={theme.colors.tint} />
            ) : (
              <Ionicons name="options-outline" size={21} color={theme.colors.tint} />
            )}
          </View>
        </AccessibleMenuView>
      </ShadowedGlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  playButton: {
    flex: 1,
    width: 'auto',
    marginTop: 0,
  },
  menuAnchor: {
    width: 46,
    height: 46,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  optionsSurface: {
    width: 46,
    height: 46,
  },
  optionsGlassSurface: {
    // Keep UIKit's glass rim visible outside the circular surface bounds.
    overflow: 'visible',
  },
  optionsMenu: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  optionsButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
