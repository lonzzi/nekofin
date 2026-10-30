import assert from 'node:assert/strict';

import { fetchAppUpdate } from '../../services/appUpdates';

// Use the same public requests and validation as the app, without API credentials.
for (const platform of ['ios', 'android'] as const) {
  const update = await fetchAppUpdate('0.0.0-0', platform, 'cnb');
  assert.ok(update, `No public CNB installer available for ${platform}`);
  assert.equal(update.source, 'cnb');
  assert.equal(new URL(update.installer.url).hostname, 'cnb.cool');
  assert.match(update.installer.sha256 ?? '', /^[a-f0-9]{64}$/);
  console.log(`Anonymous CNB app check passed: ${platform} ${update.tag} (SHA-256 available).`);
}
