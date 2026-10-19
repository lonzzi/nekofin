import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertCompatibleRuntime } from './publish.mjs';

const baseline = {
  version: 1,
  releaseTag: 'v0.1.0-beta.1',
  channel: 'production-v0.1.0-beta.1',
  url: 'https://updates.example/api/manifest',
  runtimes: { ios: 'a'.repeat(40), android: 'b'.repeat(40) },
};

test('allows JS-only updates for the exact installed native contract', () => {
  assert.doesNotThrow(() => assertCompatibleRuntime(baseline, structuredClone(baseline)));
});

test('blocks changes to either native runtime, channel, signing endpoint or release identity', () => {
  for (const changed of [
    { ...baseline, runtimes: { ...baseline.runtimes, ios: 'c'.repeat(40) } },
    { ...baseline, runtimes: { ...baseline.runtimes, android: 'c'.repeat(40) } },
    { ...baseline, channel: 'preview-v0.1.0-beta.1' },
    { ...baseline, url: 'https://another.example/api/manifest' },
    { ...baseline, releaseTag: 'v0.1.0-beta.2' },
    { ...baseline, iosBuildNumber: '1.0.4' },
  ])
    assert.throws(() => assertCompatibleRuntime(baseline, changed), /new APK\/IPA/);
});
