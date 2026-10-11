import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useAppTheme } from '@/lib/theme';
import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { DanmakuLayer, type DanmakuLayerRef } from './DanmakuLayer';

const LOOP_MS = 20000;
const messages = [
  '短弹幕',
  '这是一条比较长的弹幕，会适当加快速度',
  '一起看好故事',
  '长短弹幕共用轨道，开启防重叠后避免追尾',
];
const comments: DandanComment[] = Array.from({ length: 32 }, (_, index) => ({
  id: index,
  text: messages[index % messages.length],
  timeInSeconds: 0.2 + index * 0.45,
  mode:
    index % 8 === 6
      ? DANDAN_COMMENT_MODE.Top
      : index % 8 === 7
        ? DANDAN_COMMENT_MODE.Bottom
        : DANDAN_COMMENT_MODE.Scroll,
  colorHex: '#ffffff',
  user: '',
}));

/** Uses the production scheduler/renderer, never a separate CSS-like mock. */
export function DanmakuPreview() {
  const theme = useAppTheme();
  const { settings } = useDanmakuSettings();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [paused, setPaused] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 180 });
  const currentTime = useSharedValue(0);
  const layer = useRef<DanmakuLayerRef>(null);
  const running = focused && foreground && !paused && settings.enabled && viewport.width > 0;

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!running) return;
    let anchor = performance.now() - currentTime.get();
    const timer = setInterval(() => {
      const now = performance.now();
      let time = now - anchor;
      if (time >= LOOP_MS) {
        time %= LOOP_MS;
        anchor = now - time;
        layer.current?.seek(time);
        layer.current?.completeSeek(time, time);
      }
      currentTime.set(time);
      layer.current?.syncPlaybackTime(time);
    }, 100);
    return () => clearInterval(timer);
  }, [currentTime, running]);

  return (
    <View style={styles.container}>
      <View
        testID="danmaku-preview"
        style={styles.stage}
        onLayout={({ nativeEvent: { layout } }) =>
          setViewport((previous) =>
            previous.width === layout.width && previous.height === layout.height
              ? previous
              : { width: layout.width, height: layout.height },
          )
        }
        accessibilityLabel="弹幕效果预览"
      >
        <Text style={styles.caption}>
          {settings.enabled ? '调整下方选项，实时预览' : '弹幕已关闭'}
        </Text>
        {viewport.width > 0 && settings.enabled && focused ? (
          <DanmakuLayer
            ref={layer}
            currentTime={currentTime}
            comments={comments}
            isSeeking={false}
            playbackState={running ? 'playing' : 'paused'}
            {...settings}
            curEpOffset={0}
            danmakuFilter={0}
            viewport={viewport}
          />
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setPaused((value) => !value)}
        disabled={!settings.enabled}
        style={styles.action}
      >
        <Text style={{ color: settings.enabled ? theme.colors.tint : theme.colors.textSecondary }}>
          {paused ? '继续预览' : '暂停预览'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  stage: { height: 180, backgroundColor: '#172126', borderRadius: 12, overflow: 'hidden' },
  caption: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    color: '#c5ced2',
    fontSize: 13,
  },
  action: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
