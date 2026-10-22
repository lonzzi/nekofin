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
import { useTranslation } from '@/lib/i18n';
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
  const { t: tr } = useTranslation();
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
    ? tr('home.partialError')
    : latestSample?.nativeMetricsAvailable
      ? tr('server.connected')
      : tr('server.disconnected');
  const nativeStatusDetail = latestSample?.nativeMetricsError;

  return (
    <NativeSettingsForm testID="performance-settings-form">
      <NativeSettingsSection
        title={tr('diagnostics.sampling')}
        footer={tr('diagnostics.samplingDescription')}
      >
        <NativeSettingsSwitch
          title={<SettingsTitle>{tr('diagnostics.enable')}</SettingsTitle>}
          value={settings.enabled}
          onValueChange={(enabled) =>
            updateSettings({
              enabled,
              overlayVisible: enabled ? settings.overlayVisible : false,
            })
          }
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>{tr('diagnostics.showOverlay')}</SettingsTitle>}
          value={settings.overlayVisible}
          disabled={!settings.enabled}
          onValueChange={(overlayVisible) => updateSettings({ overlayVisible })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>{tr('diagnostics.recordNetworkRequests')}</SettingsTitle>}
          value={settings.networkCaptureEnabled}
          disabled={!settings.enabled}
          onValueChange={(networkCaptureEnabled) => updateSettings({ networkCaptureEnabled })}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>{tr('diagnostics.saveLogs')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={tr('diagnostics.retentionDescription')} />}
          value={settings.persistentLogsEnabled}
          onValueChange={(persistentLogsEnabled) => updateSettings({ persistentLogsEnabled })}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('diagnostics.samplingInterval')}</SettingsTitle>}
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

      <NativeSettingsSection title={tr('diagnostics.liveMetrics')}>
        <NativeSettingsItem
          title={<SettingsTitle>{tr('diagnostics.nativeMetrics')}</SettingsTitle>}
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
          title={<SettingsTitle>{tr('diagnostics.cpuAndMemory')}</SettingsTitle>}
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
          title={<SettingsTitle>{tr('diagnostics.eventLoopDelay')}</SettingsTitle>}
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
          title={<SettingsTitle>{tr('diagnostics.refreshRate')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={tr('diagnostics.refreshRateDescription')} />}
          trailing={
            <SettingsValue
              label={`${formatHz(latestSample?.deviceCurrentRefreshRate)} / ${formatHz(
                latestSample?.deviceMaxRefreshRate,
              )}`}
            />
          }
        />
        <NativeSettingsItem
          title={<SettingsTitle>{tr('diagnostics.queriesAndNetwork')}</SettingsTitle>}
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

      <NativeSettingsSection title={tr('diagnostics.data')}>
        <NativeSettingsItem
          title={
            <SettingsActionTitle tone={hasDiagnosticLogs ? 'accent' : 'muted'}>
              {tr('diagnostics.exportJson')}
            </SettingsActionTitle>
          }
          onPress={handleExport}
          disabled={!hasDiagnosticLogs}
        />
        <NativeSettingsItem
          title={<SettingsActionTitle>{tr('diagnostics.clearRecords')}</SettingsActionTitle>}
          subtitle={<SettingsSubtitle primary={tr('diagnostics.clearRecordsDescription')} />}
          onPress={handleClearDiagnostics}
        />
        <NativeSettingsItem
          title={
            <SettingsActionTitle tone="accent">{tr('diagnostics.hideEntry')}</SettingsActionTitle>
          }
          subtitle={<SettingsSubtitle primary={tr('diagnostics.disableAllDescription')} />}
          onPress={handleHideDiagnostics}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
