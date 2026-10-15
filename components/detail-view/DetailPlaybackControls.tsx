import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { usePlaybackPreferences } from '@/hooks/usePlaybackPreferences';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import {
  playbackTrackLabel,
  resolvePlaybackSelection,
  type PlaybackSelection,
} from '@/services/media/playbackSelection';
import { mediaSourcesQueryOptions } from '@/services/media/queryOptions';
import type { MediaItem } from '@/services/media/types';
import { Button, Column, Host, Text as NativeText, Row, Spacer } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Platform, useWindowDimensions, View } from 'react-native';

import { PlayButton } from './common';
import { PlaybackPicker as Picker } from './PlaybackPicker';

export function DetailPlaybackControls({ item }: { item: MediaItem }) {
  // Remount when changing episodes so an earlier episode's indices cannot leak.
  return <ItemPlaybackControls key={item.id} item={item} />;
}

function ItemPlaybackControls({ item }: { item: MediaItem }) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [controlsWidth, setControlsWidth] = useState<number>();
  // Native SwiftUI frames take point widths; percentage strings are RN-only.
  const rowStyle = {
    width: controlsWidth,
    height: Math.max(Platform.OS === 'android' ? 64 : 44, 30 * fontScale),
  };
  const adapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const query = useQuery(mediaSourcesQueryOptions({ adapter, currentServer, itemId: item.id }));
  const sources = query.data?.mediaSources ?? [];
  const [choice, setChoice] = useState<PlaybackSelection>({});
  const preferences = usePlaybackPreferences();
  const selected = resolvePlaybackSelection(sources, choice, preferences);
  const source = sources.find((entry) => entry.id === selected.mediaSourceId);
  const audio = source?.mediaStreams.filter((stream) => stream.type === 'Audio') ?? [];
  const subtitles = source?.mediaStreams.filter((stream) => stream.type === 'Subtitle') ?? [];
  const labelStyle = { color: theme.colors.text, fontSize: 15 };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <PlayButton item={item} selection={selected} />
      {query.isPending ? <ActivityIndicator accessibilityLabel="正在读取播放选项" /> : null}
      {source || query.isError ? (
        <Host
          matchContents={{ vertical: true }}
          colorScheme={theme.colorScheme}
          seedColor={theme.colors.tint}
          style={{ width: '100%' }}
          onLayout={({ nativeEvent }) => setControlsWidth(nativeEvent.layout.width)}
        >
          <Column spacing={8} style={{ width: controlsWidth }}>
            {source ? (
              <>
                <Row alignment="center" spacing={8} style={rowStyle}>
                  <NativeText textStyle={labelStyle}>视频版本</NativeText>
                  <Spacer />
                  <Picker
                    testID="detail-video-version"
                    selectedValue={source.id}
                    enabled={sources.length > 1}
                    onValueChange={(mediaSourceId) => setChoice({ mediaSourceId })}
                  >
                    {sources.map((entry, index) => (
                      <Picker.Item
                        key={entry.id}
                        value={entry.id}
                        label={entry.name || `${entry.container.toUpperCase()} · 版本 ${index + 1}`}
                      />
                    ))}
                  </Picker>
                </Row>
                <Row alignment="center" spacing={8} style={rowStyle}>
                  <NativeText textStyle={labelStyle}>音轨</NativeText>
                  <Spacer />
                  <Picker
                    testID="detail-audio-track"
                    selectedValue={selected.audioStreamIndex ?? -1}
                    enabled={audio.length > 1}
                    onValueChange={(audioStreamIndex) =>
                      setChoice((previous) => ({
                        ...previous,
                        mediaSourceId: source.id,
                        audioStreamIndex,
                      }))
                    }
                  >
                    {audio.length ? (
                      audio.map((stream) => (
                        <Picker.Item
                          key={stream.index}
                          value={stream.index}
                          label={playbackTrackLabel(stream)}
                        />
                      ))
                    ) : (
                      <Picker.Item value={-1} label="无音轨" />
                    )}
                  </Picker>
                </Row>
                <Row alignment="center" spacing={8} style={rowStyle}>
                  <NativeText textStyle={labelStyle}>字幕</NativeText>
                  <Spacer />
                  <Picker
                    testID="detail-subtitle-track"
                    selectedValue={selected.subtitleStreamIndex ?? -1}
                    enabled={subtitles.length > 0}
                    onValueChange={(subtitleStreamIndex) =>
                      setChoice((previous) => ({
                        ...previous,
                        mediaSourceId: source.id,
                        subtitleStreamIndex,
                      }))
                    }
                  >
                    <Picker.Item value={-1} label="关闭" />
                    {subtitles.map((stream) => (
                      <Picker.Item
                        key={stream.index}
                        value={stream.index}
                        label={playbackTrackLabel(stream)}
                      />
                    ))}
                  </Picker>
                </Row>
              </>
            ) : null}
            {query.isError ? (
              <Button onPress={() => void query.refetch()}>重新读取播放选项</Button>
            ) : null}
          </Column>
        </Host>
      ) : null}
    </View>
  );
}
