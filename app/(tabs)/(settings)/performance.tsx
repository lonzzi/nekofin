import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSlider,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsSubtitle,
  SettingsSymbol,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { formatDurationMs } from '@/lib/performance/performanceMetrics';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import { useCallback } from 'react';
import { Share } from 'react-native';

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

export default function PerformanceSettingsScreen() {
  const router = useTracedRouter('performance-settings');
  const monitor = usePerformanceMonitor();
  const { clear, exportText, settings, snapshot, updateSettings } = monitor;
  const { lock } = usePerformanceDiagnosticsUnlock();
  const hasDiagnosticLogs = snapshot.samples.length > 0 || snapshot.events.length > 0;

  const handleExport = useCallback(() => {
    void Share.share({
      message: exportText(),
      title: 'Nekofin performance trace',
    });
  }, [exportText]);

  const handleHideDiagnostics = useCallback(() => {
    updateSettings({ enabled: false, overlayVisible: false });
    lock();
    router.back();
  }, [lock, router, updateSettings]);

  const handleClearDiagnostics = useCallback(() => {
    clear();
  }, [clear]);

  const latestSample = snapshot.latestSample;
  const nativeStatus = latestSample?.nativeMetricsError
    ? '部分异常'
    : latestSample?.nativeMetricsAvailable
      ? '已连接'
      : '未连接';
  const nativeStatusDetail = latestSample?.nativeMetricsError
    ? latestSample.nativeMetricsError
    : latestSample?.nativeMetricsAvailable
      ? 'react-native-performance-toolkit 已连接'
      : '等待采样';

  return (
    <NativeSettingsForm testID="performance-settings-form">
      <NativeSettingsSection title="采样">
        <NativeSettingsSwitch
          title={<SettingsTitle>启用性能分析</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary="开启后采集 native UI/JS FPS、CPU、内存，并记录路由、网络和 Query 活动。"
              lines={2}
            />
          }
          value={settings.enabled}
          onValueChange={(enabled) =>
            updateSettings({
              enabled,
              overlayVisible: enabled ? settings.overlayVisible : false,
            })
          }
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>显示浮层</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="复现卡顿时建议打开，平时保持关闭。" lines={2} />}
          value={settings.overlayVisible}
          disabled={!settings.enabled}
          onValueChange={(overlayVisible) => updateSettings({ overlayVisible })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>记录网络请求</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="记录 fetch 耗时、状态码和慢请求。" lines={2} />}
          value={settings.networkCaptureEnabled}
          disabled={!settings.enabled}
          onValueChange={(networkCaptureEnabled) => updateSettings({ networkCaptureEnabled })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>保存诊断日志</SettingsTitle>}
          subtitle={
            <SettingsSubtitle primary="默认保存最近的采样和 trace，方便复现后再导出。" lines={2} />
          }
          value={settings.persistentLogsEnabled}
          onValueChange={(persistentLogsEnabled) => updateSettings({ persistentLogsEnabled })}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>采样间隔</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="间隔越短越精确，也会带来更高诊断开销。" lines={2} />}
          value={settings.sampleIntervalMs}
          min={250}
          max={3000}
          step={250}
          disabled={!settings.enabled}
          formatValue={(value) => `${Math.round(value)}ms`}
          onValueChange={(sampleIntervalMs) =>
            updateSettings({ sampleIntervalMs: Math.round(sampleIntervalMs) })
          }
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="实时指标">
        <NativeSettingsItem
          title={<SettingsTitle>Native 指标</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={nativeStatusDetail} lines={2} />}
          value={nativeStatus}
        />
        <NativeSettingsItem
          title={<SettingsTitle>UI / JS FPS</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary={`RAF JS ${formatFps(latestSample?.rafJsFps)} · min UI ${formatFps(
                snapshot.summary.minUiFps,
              )}`}
            />
          }
          trailing={
            <SettingsValue
              label={`${formatFps(latestSample?.uiFps)} / ${formatFps(latestSample?.jsFps)}`}
            />
          }
        />
        <NativeSettingsItem
          title={<SettingsTitle>CPU / 内存</SettingsTitle>}
          subtitle={
            <SettingsSubtitle primary={`max CPU ${formatPercent(snapshot.summary.maxCpuUsage)}`} />
          }
          trailing={
            <SettingsValue
              label={`${formatPercent(latestSample?.cpuUsage)} / ${formatMb(
                latestSample?.memoryMB,
              )}`}
            />
          }
        />
        <NativeSettingsItem
          title={<SettingsTitle>事件循环延迟</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary={`p95 ${formatDurationMs(snapshot.summary.p95LagMs)} · max frame ${formatDurationMs(
                snapshot.summary.maxFrameMs,
              )}`}
            />
          }
          value={formatDurationMs(latestSample?.eventLoopLagMs)}
        />
        <NativeSettingsItem
          title={<SettingsTitle>刷新率</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="当前刷新率 / 设备最大刷新率" />}
          trailing={
            <SettingsValue
              label={`${formatHz(latestSample?.deviceCurrentRefreshRate)} / ${formatHz(
                latestSample?.deviceMaxRefreshRate,
              )}`}
            />
          }
        />
        <NativeSettingsItem
          title={<SettingsTitle>Query / 网络</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary={`samples ${snapshot.summary.sampleCount} · native ${snapshot.summary.nativeSampleCount}`}
            />
          }
          value={`${latestSample?.queryFetchingCount ?? 0} / ${
            latestSample?.networkPendingCount ?? 0
          }`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="数据">
        <NativeSettingsItem
          leading={<SettingsSymbol name="square.and.arrow.up" />}
          title={<SettingsTitle>导出 JSON</SettingsTitle>}
          subtitle={
            <SettingsSubtitle primary="分享当前保存的采样、路由、网络和 Query trace。" lines={2} />
          }
          trailing={<SettingsValue label={hasDiagnosticLogs ? '导出' : '无数据'} tone="accent" />}
          onPress={hasDiagnosticLogs ? handleExport : undefined}
        />
        <NativeSettingsItem
          leading={<SettingsSymbol name="trash" tone="danger" />}
          title={<SettingsTitle>清空诊断记录</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="清除当前内存记录和已保存的性能日志。" lines={2} />}
          trailing={<SettingsValue label="清空" tone="danger" />}
          onPress={handleClearDiagnostics}
        />
        <NativeSettingsItem
          leading={<SettingsSymbol name="eye.slash" tone="muted" />}
          title={<SettingsTitle>隐藏诊断入口</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="关闭采样并从设置页移除性能分析入口。" lines={2} />}
          trailing={<SettingsValue label="隐藏" tone="muted" />}
          onPress={handleHideDiagnostics}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
