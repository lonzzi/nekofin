import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSlider,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import {
  formatDurationMs,
  formatFps,
  formatHz,
  formatMb,
  formatPercent,
} from '@/lib/performance/performanceMetrics';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import { useCallback } from 'react';
import { Share } from 'react-native';

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
  const nativeStatusDetail = latestSample?.nativeMetricsError;

  return (
    <NativeSettingsForm testID="performance-settings-form">
      <NativeSettingsSection
        title="采样"
        footer="采样间隔越短，诊断开销越高。关闭性能分析后停止采样。"
      >
        <NativeSettingsSwitch
          title={<SettingsTitle>启用性能分析</SettingsTitle>}
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
          value={settings.overlayVisible}
          disabled={!settings.enabled}
          onValueChange={(overlayVisible) => updateSettings({ overlayVisible })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>记录网络请求</SettingsTitle>}
          value={settings.networkCaptureEnabled}
          disabled={!settings.enabled}
          onValueChange={(networkCaptureEnabled) => updateSettings({ networkCaptureEnabled })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>保存诊断日志</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="保留最近的采样记录，便于稍后导出。" />}
          value={settings.persistentLogsEnabled}
          onValueChange={(persistentLogsEnabled) => updateSettings({ persistentLogsEnabled })}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>采样间隔</SettingsTitle>}
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
          subtitle={
            nativeStatusDetail ? (
              <SettingsSubtitle primary={nativeStatusDetail} lines={2} />
            ) : undefined
          }
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
          subtitle={<SettingsSubtitle primary="当前刷新率 / 设备最高刷新率" />}
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
          title={
            <SettingsActionTitle tone={hasDiagnosticLogs ? 'accent' : 'muted'}>
              导出 JSON
            </SettingsActionTitle>
          }
          onPress={handleExport}
          disabled={!hasDiagnosticLogs}
        />
        <NativeSettingsItem
          title={<SettingsActionTitle>清空诊断记录</SettingsActionTitle>}
          subtitle={<SettingsSubtitle primary="清除内存记录和已保存的诊断日志。" />}
          onPress={handleClearDiagnostics}
        />
        <NativeSettingsItem
          title={<SettingsActionTitle tone="accent">隐藏诊断入口</SettingsActionTitle>}
          subtitle={<SettingsSubtitle primary="同时关闭性能分析和浮层。" />}
          onPress={handleHideDiagnostics}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
