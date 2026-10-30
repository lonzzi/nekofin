import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAddSourceResponse } from './add-source.mjs';

test('all README buttons open the selected app with the canonical channel and provider', async () => {
  for (const tool of ['altstore', 'livecontainer'])
    for (const channel of ['stable', 'beta'])
      for (const source of ['github', 'cnb']) {
        const response = createAddSourceResponse(
          new Request(
            `https://test/api/add-source?tool=${tool}&channel=${channel}&source=${source}`,
          ),
        );
        assert.equal(response.status, 200);
        const html = await response.text();
        const match = /href="((?:altstore|livecontainer):[^"]+)"/.exec(html);
        const link = new URL(match[1]);
        assert.equal(link.protocol, `${tool}:`);
        assert.equal(link.hostname, 'source');
        assert.equal(
          link.searchParams.get('url'),
          `https://${source === 'cnb' ? 'cnb.cool/lonzzi/nekofin/-' : 'github.com/lonzzi/nekofin'}/releases/download/app-sources/${channel}.json`,
        );
        assert.match(html, /navigator.maxTouchPoints > 1/);
        assert.match(response.headers.get('content-security-policy'), /script-src 'sha256-/);
      }
});

test('refuses arbitrary redirects, injected markup and ambiguous parameters', async () => {
  for (const query of [
    'tool=other',
    'source=evil',
    'url=https://evil.example',
    'tool=altstore&tool=livecontainer',
    'channel=%22%3E%3Cscript%3E',
  ]) {
    const response = createAddSourceResponse(new Request(`https://test/api/add-source?${query}`));
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /script>/);
  }
  assert.equal(
    createAddSourceResponse(new Request('https://test', { method: 'POST' })).status,
    405,
  );
  const head = createAddSourceResponse(new Request('https://test', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
