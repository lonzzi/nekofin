import {
  summarizePerformanceSamples,
  type PerformanceEvent,
  type PerformanceSample,
} from './performanceMetrics';

export type DiagnosticData = Record<string, unknown>;

const secretKey = /token|password|authorization|cookie|secret|api[_-]?key|playSessionId/i;

export function redactDiagnosticText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[redacted URL]';
      }
    })
    .replace(/\b(Bearer)\s+\S+/gi, '$1 [redacted]')
    .replace(
      /\b((?:access[_-]?)?token|password|authorization|cookie|secret|api[_-]?key)\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      '$1=[redacted]',
    );
}

/** Redact before persistence, including nested native errors and signed URLs. */
export function sanitizeDiagnosticData(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth limit]';
  if (value instanceof Error)
    return { name: value.name, message: redactDiagnosticText(value.message) };
  if (typeof value === 'string') return redactDiagnosticText(value).slice(0, 4000);
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value))
    return value.slice(0, 100).map((entry) => sanitizeDiagnosticData(entry, depth + 1));
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, entry]) => [
          key,
          secretKey.test(key) ? '[redacted]' : sanitizeDiagnosticData(entry, depth + 1),
        ]),
    );
  return undefined;
}

function linesFor(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return Object.entries(value).flatMap(([key, entry]) =>
      entry === undefined ? [] : linesFor(entry, prefix ? `${prefix}.${key}` : key),
    );
  return [
    `${prefix}: ${typeof value === 'string' ? value : (JSON.stringify(value) ?? 'unavailable')}`,
  ];
}

export function formatDiagnosticReport({
  generatedAt,
  environment,
  settings,
  samples,
  events,
  pendingTraces = [],
}: {
  generatedAt: string;
  environment: DiagnosticData;
  settings: DiagnosticData;
  samples: PerformanceSample[];
  events: PerformanceEvent[];
  pendingTraces?: unknown[];
}) {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const latestFirst = [...ordered].reverse();
  const source = latestFirst.find((event) => event.name === 'player.source');
  const snapshot = latestFirst.find(
    (event) =>
      event.name === 'player.snapshot' &&
      (!source ||
        (event.timestamp >= source.timestamp && event.data?.sessionId === source.data?.sessionId)),
  );
  const report = [
    'NekoFin diagnostic log',
    `Generated: ${generatedAt}`,
    'Timestamps: UTC (ISO 8601)',
    'Scope: app events, playback snapshots and JS HTTP requests; native mpv HTTP traffic is not a JS request.',
    '',
    '[Device and application]',
    ...linesFor(environment),
    '',
    '[Collection settings]',
    ...linesFor(settings),
    '',
    '[Latest playback]',
    ...linesFor({
      ...source?.data,
      ...snapshot?.data,
      capturedAt:
        snapshot || source ? new Date((snapshot ?? source)!.timestamp).toISOString() : undefined,
    }),
    '',
    '[Performance summary]',
    ...linesFor(summarizePerformanceSamples(samples)),
    '',
    '[Pending operations at export]',
    ...linesFor(pendingTraces, 'operations'),
    '',
    '[Event timeline]',
    ...(ordered.length
      ? ordered.flatMap((event) => [
          `${new Date(event.timestamp).toISOString()} [${event.type.toUpperCase()}] [${event.status.toUpperCase()}] ${event.name}${event.durationMs == null ? '' : ` (${Math.round(event.durationMs)} ms)`}`,
          ...(event.detail ? [`  ${event.detail}`] : []),
          ...(event.data ? linesFor(event.data).map((line) => `  ${line}`) : []),
        ])
      : ['No events collected. Enable diagnostics before reproducing the issue.']),
    '',
    '[Performance samples]',
    ...samples.map(
      (sample) => `${new Date(sample.timestamp).toISOString()} ${linesFor(sample).join(' | ')}`,
    ),
    '',
  ];
  return redactDiagnosticText(report.join('\n'));
}
