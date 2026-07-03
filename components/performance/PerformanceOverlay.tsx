import { formatDurationMs } from '@/lib/performance/performanceMetrics';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

function formatFps(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return Math.round(value).toString();
}

function formatMb(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}MB`;
}

function formatPercent(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatHz(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${Math.round(value)}Hz`;
}

export function PerformanceOverlay() {
  const theme = useAppTheme();
  const { clear, exportText, settings, snapshot } = usePerformanceMonitor();
  const [expanded, setExpanded] = useState(false);
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

  if (!settings.enabled || !settings.overlayVisible) return null;

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
  const nativeStatus = latestSample?.nativeMetricsError
    ? 'partial'
    : latestSample?.nativeMetricsAvailable
      ? 'on'
      : 'off';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.panel,
          expanded ? styles.panelExpanded : styles.panelCompact,
          {
            backgroundColor: theme.isDark ? 'rgba(18,18,20,0.92)' : 'rgba(255,255,255,0.94)',
            borderColor: theme.colors.separator,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? '收起性能分析浮层' : '展开性能分析浮层'}
          onPress={() => setExpanded((value) => !value)}
          style={styles.header}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>Perf</Text>
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
                <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>清空</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
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
    top: Platform.OS === 'ios' ? 58 : 28,
    right: 12,
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
  panelCompact: {
    width: 226,
  },
  panelExpanded: {
    width: 326,
  },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
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
