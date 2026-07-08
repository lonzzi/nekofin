import {
  formatDurationMs,
  formatFps,
  formatHz,
  formatMb,
  formatPercent,
} from '@/lib/performance/performanceMetrics';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { storage } from '@/lib/storage';
import { useAppTheme } from '@/lib/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const OVERLAY_POSITION_STORAGE_KEY = 'performanceOverlay.position.v1';
const PANEL_EDGE_PADDING = 8;
const PANEL_COMPACT_WIDTH = 226;
const PANEL_EXPANDED_WIDTH = 326;
const PANEL_COMPACT_HEIGHT = 58;
const PANEL_EXPANDED_ESTIMATED_HEIGHT = 420;
const PANEL_INITIAL_TOP = Platform.OS === 'ios' ? 58 : 28;

type OverlayPosition = {
  x: number;
  y: number;
};

function clampOverlayX(x: number, viewportWidth: number, panelWidth: number) {
  'worklet';
  const maxX = Math.max(PANEL_EDGE_PADDING, viewportWidth - panelWidth - PANEL_EDGE_PADDING);
  return Math.min(maxX, Math.max(PANEL_EDGE_PADDING, x));
}

function clampOverlayY(y: number, viewportHeight: number, panelHeight: number) {
  'worklet';
  const maxY = Math.max(PANEL_EDGE_PADDING, viewportHeight - panelHeight - PANEL_EDGE_PADDING);
  return Math.min(maxY, Math.max(PANEL_EDGE_PADDING, y));
}

function getDefaultOverlayPosition(viewportWidth: number, panelWidth: number): OverlayPosition {
  return {
    x: clampOverlayX(viewportWidth - panelWidth - 12, viewportWidth, panelWidth),
    y: PANEL_INITIAL_TOP,
  };
}

function readOverlayPosition(viewportWidth: number, viewportHeight: number, panelWidth: number) {
  const defaultPosition = getDefaultOverlayPosition(viewportWidth, panelWidth);
  const raw = storage.getString(OVERLAY_POSITION_STORAGE_KEY);
  if (!raw) return defaultPosition;

  try {
    const parsed = JSON.parse(raw) as Partial<OverlayPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return defaultPosition;

    return {
      x: clampOverlayX(parsed.x, viewportWidth, panelWidth),
      y: clampOverlayY(parsed.y, viewportHeight, PANEL_COMPACT_HEIGHT),
    };
  } catch {
    return defaultPosition;
  }
}

function saveOverlayPosition(x: number, y: number) {
  storage.set(OVERLAY_POSITION_STORAGE_KEY, JSON.stringify({ x, y }));
}

export function PerformanceOverlay() {
  const theme = useAppTheme();
  const { clear, exportText, settings, snapshot } = usePerformanceMonitor();
  const [expanded, setExpanded] = useState(false);
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const panelWidth = Math.min(
    expanded ? PANEL_EXPANDED_WIDTH : PANEL_COMPACT_WIDTH,
    Math.max(PANEL_COMPACT_WIDTH, viewportWidth - PANEL_EDGE_PADDING * 2),
  );
  const panelEstimatedHeight = expanded ? PANEL_EXPANDED_ESTIMATED_HEIGHT : PANEL_COMPACT_HEIGHT;
  const initialPosition = useMemo(
    () => readOverlayPosition(viewportWidth, viewportHeight, PANEL_COMPACT_WIDTH),
    [viewportHeight, viewportWidth],
  );
  const translateX = useSharedValue(initialPosition.x);
  const translateY = useSharedValue(initialPosition.y);
  const dragStartX = useSharedValue(initialPosition.x);
  const dragStartY = useSharedValue(initialPosition.y);
  const latestSample = snapshot.latestSample;

  const recentEvents = useMemo(
    () =>
      snapshot.events
        .slice()
        .reverse()
        .filter((event) => event.type !== 'mark')
        .slice(0, expanded ? 8 : 3),
    [expanded, snapshot.events],
  );

  const uiFpsForHealth = latestSample?.uiFps ?? latestSample?.jsFps;
  const fpsColor =
    uiFpsForHealth != null && uiFpsForHealth < 45
      ? theme.colors.danger
      : uiFpsForHealth != null && uiFpsForHealth < 55
        ? '#ff9f0a'
        : '#34c759';
  const lagColor =
    latestSample && latestSample.eventLoopLagMs > 80
      ? theme.colors.danger
      : latestSample && latestSample.eventLoopLagMs > 35
        ? '#ff9f0a'
        : theme.colors.textSecondary;

  const handleExport = () => {
    void Share.share({
      message: exportText(),
      title: 'Nekofin performance trace',
    });
  };
  const persistOverlayPosition = useCallback((x: number, y: number) => {
    saveOverlayPosition(x, y);
  }, []);

  useEffect(() => {
    const nextX = clampOverlayX(translateX.value, viewportWidth, panelWidth);
    const nextY = clampOverlayY(translateY.value, viewportHeight, panelEstimatedHeight);
    translateX.value = withTiming(nextX, { duration: 160 });
    translateY.value = withTiming(nextY, { duration: 160 });
    saveOverlayPosition(nextX, nextY);
  }, [panelEstimatedHeight, panelWidth, translateX, translateY, viewportHeight, viewportWidth]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onBegin(() => {
          dragStartX.value = translateX.value;
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          translateX.value = clampOverlayX(
            dragStartX.value + event.translationX,
            viewportWidth,
            panelWidth,
          );
          translateY.value = clampOverlayY(
            dragStartY.value + event.translationY,
            viewportHeight,
            panelEstimatedHeight,
          );
        })
        .onEnd(() => {
          scheduleOnRN(persistOverlayPosition, translateX.value, translateY.value);
        }),
    [
      dragStartX,
      dragStartY,
      panelEstimatedHeight,
      panelWidth,
      persistOverlayPosition,
      translateX,
      translateY,
      viewportHeight,
      viewportWidth,
    ],
  );

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const nativeStatus = latestSample?.nativeMetricsError
    ? 'partial'
    : latestSample?.nativeMetricsAvailable
      ? 'on'
      : 'off';

  if (!settings.enabled || !settings.overlayVisible) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.panel,
            panelAnimatedStyle,
            {
              backgroundColor: theme.isDark ? 'rgba(18,18,20,0.92)' : 'rgba(255,255,255,0.94)',
              borderColor: theme.colors.separator,
              maxHeight: viewportHeight - PANEL_EDGE_PADDING * 2,
              width: panelWidth,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? '收起性能分析浮层' : '展开性能分析浮层'}
            onPress={() => setExpanded((value) => !value)}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Perf</Text>
              <View style={[styles.dragHandle, { backgroundColor: theme.colors.separator }]} />
            </View>
            <View style={styles.metricRow}>
              <Text style={[styles.metric, { color: fpsColor }]}>
                UI {formatFps(latestSample?.uiFps)}
              </Text>
              <Text style={[styles.metric, { color: fpsColor }]}>
                JS {formatFps(latestSample?.jsFps)}
              </Text>
              <Text style={[styles.metric, { color: lagColor }]}>
                CPU {formatPercent(latestSample?.cpuUsage)}
              </Text>
              <Text style={[styles.metric, { color: theme.colors.textSecondary }]}>
                RAM {formatMb(latestSample?.memoryMB)}
              </Text>
            </View>
          </Pressable>

          {expanded ? (
            <View style={styles.body}>
              <View style={styles.grid}>
                <Metric label="native" value={nativeStatus} />
                <Metric label="refresh" value={formatHz(latestSample?.deviceCurrentRefreshRate)} />
                <Metric label="max hz" value={formatHz(latestSample?.deviceMaxRefreshRate)} />
                <Metric label="min ui" value={formatFps(snapshot.summary.minUiFps)} />
                <Metric label="min js" value={formatFps(snapshot.summary.minJsFps)} />
                <Metric label="max cpu" value={formatPercent(snapshot.summary.maxCpuUsage)} />
                <Metric label="max ram" value={formatMb(snapshot.summary.maxMemoryMB)} />
                <Metric label="raf js" value={formatFps(latestSample?.rafJsFps)} />
                <Metric label="max frame" value={formatDurationMs(latestSample?.maxFrameMs)} />
                <Metric label="js heap" value={formatMb(latestSample?.jsHeapMB)} />
                <Metric label="fetch" value={String(latestSample?.networkPendingCount ?? 0)} />
                <Metric label="query" value={String(latestSample?.queryFetchingCount ?? 0)} />
                <Metric label="p95 lag" value={formatDurationMs(snapshot.summary.p95LagMs)} />
              </View>

              {latestSample?.nativeMetricsError ? (
                <Text
                  numberOfLines={2}
                  style={[styles.nativeErrorText, { color: theme.colors.danger }]}
                >
                  {latestSample.nativeMetricsError}
                </Text>
              ) : null}

              <View style={styles.events}>
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <View key={event.id} style={styles.eventRow}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.eventName,
                          {
                            color:
                              event.status === 'slow' || event.status === 'error'
                                ? theme.colors.danger
                                : theme.colors.text,
                          },
                        ]}
                      >
                        {event.name}
                      </Text>
                      <Text style={[styles.eventDuration, { color: theme.colors.textSecondary }]}>
                        {formatDurationMs(event.durationMs)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    等待交互 trace
                  </Text>
                )}
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="导出性能分析 JSON"
                  onPress={handleExport}
                  style={[styles.actionButton, { borderColor: theme.colors.separator }]}
                >
                  <Text style={[styles.actionText, { color: theme.colors.tint }]}>导出</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="清空性能分析数据"
                  onPress={clear}
                  style={[styles.actionButton, { borderColor: theme.colors.separator }]}
                >
                  <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
                    清空
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricLabel, { color: theme.colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  headerTop: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dragHandle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    opacity: 0.85,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCell: {
    width: 94,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
  },
  metricValue: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  events: {
    gap: 5,
  },
  nativeErrorText: {
    fontSize: 10,
    lineHeight: 13,
  },
  eventRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
  },
  eventDuration: {
    width: 54,
    textAlign: 'right',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 30,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
