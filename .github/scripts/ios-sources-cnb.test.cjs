const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildUpdateIndex } = require('./ios-sources-cnb.cjs');

function release(tag = 'v0.1.0-beta.8') {
  return {
    tag_name: tag,
    draft: false,
    prerelease: true,
    internalField: 'not published',
    assets: [
      {
        name: `nekofin-${tag}-android-arm64.apk`,
        size: 100,
        hash_algo: 'SHA256',
        hash_value: 'a'.repeat(64),
        browser_download_url: 'https://ignored.example',
      },
      { name: `nekofin-${tag}-ios-unsigned.ipa`, size: 200 },
      { name: 'SHA256SUMS', size: 300 },
    ],
  };
}

test('publishes only validated native releases and public installer metadata', () => {
  const item = release();
  const snapshot = buildUpdateIndex([
    item,
    { ...item, draft: true },
    release('ota-catalog'),
    { ...release('v0.2.0'), prerelease: true },
    { ...release('v0.1.0-beta.9'), assets: [] },
  ]);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.releases.length, 1);
  assert.deepEqual(snapshot.releases[0], {
    tag_name: item.tag_name,
    draft: false,
    prerelease: true,
    assets: [
      { name: item.assets[0].name, size: 100, hash_algo: 'SHA256', hash_value: 'a'.repeat(64) },
      { name: item.assets[1].name, size: 200 },
    ],
  });
  assert.ok(!JSON.stringify(snapshot).includes('internalField'));
  assert.ok(!JSON.stringify(snapshot).includes('ignored.example'));
});

test('keeps Android-only releases available without requiring iOS catalog metadata', () => {
  const item = release();
  item.assets = [item.assets[0]];
  assert.equal(buildUpdateIndex([item]).releases[0].assets.length, 1);
});
