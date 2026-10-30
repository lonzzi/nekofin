import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAddSourceResponse } from './add-source.mjs';

test('all source links redirect directly without rendering an intermediate page', async () => {
  for (const tool of ['altstore', 'livecontainer'])
    for (const channel of ['stable', 'beta'])
      for (const source of ['github', 'cnb']) {
        const response = createAddSourceResponse(
          new Request(
            `https://test/api/add-source?tool=${tool}&channel=${channel}&source=${source}`,
          ),
        );
        assert.equal(response.status, 302);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const expected = `https://${source === 'cnb' ? 'cnb.cool/lonzzi/nekofin/-' : 'github.com/lonzzi/nekofin'}/releases/download/app-sources/${channel}.json`;
        const link = new URL(response.headers.get('location'));
        assert.equal(link.protocol, tool === 'altstore' ? 'altstore-classic:' : 'livecontainer:');
        assert.equal(link.hostname, 'source');
        assert.equal(link.searchParams.get('url'), expected);
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
  assert.equal(head.status, 302);
  assert.equal(await head.text(), '');
});
