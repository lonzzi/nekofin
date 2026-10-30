const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSource, publishSources } = require('./ios-sources.cjs');
const { iosBuildNumber } = require('./ios-build-number.cjs');

function entry(tag, build, overrides = {}) {
  return {
    release: {
      tag_name: tag,
      draft: false,
      prerelease: tag.includes('-'),
      published_at: '2026-10-19T00:00:00Z',
      body: tag,
      assets: [{ name: `nekofin-${tag}-ios-unsigned.ipa`, state: 'uploaded', size: 100 }],
    },
    metadata: {
      tag,
      version: tag.slice(1).split('-')[0],
      buildVersion: build,
      bundleIdentifier: 'com.lonzzi.nekofin',
      size: 100,
      minOSVersion: '16.4',
      appPermissions: {
        entitlements: [],
        privacy: { NSLocalNetworkUsageDescription: '媒体服务器访问' },
      },
      ...overrides,
    },
  };
}

test('CNB catalogs have distinct identities and advertise only canonical CNB IPA URLs', () => {
  const entries = [entry('v0.1.0-beta.8', '1.0.8')];
  const github = buildSource(entries, 'beta');
  const cnb = buildSource(entries, 'beta', 'cnb');
  assert.notEqual(github.identifier, cnb.identifier);
  assert.equal(
    cnb.sourceURL,
    'https://cnb.cool/lonzzi/nekofin/-/releases/download/app-sources/beta.json',
  );
  assert.ok(cnb.apps[0].iconURL.startsWith('https://cnb.cool/'));
  assert.equal(
    cnb.apps[0].versions[0].downloadURL,
    'https://cnb.cool/lonzzi/nekofin/-/releases/download/v0.1.0-beta.8/nekofin-v0.1.0-beta.8-ios-unsigned.ipa',
  );
  assert.deepEqual(buildSource(entries, 'stable', 'cnb').apps, []);
});

test('assigns unique, monotonic plist-compatible build numbers across beta release runs', () => {
  assert.equal(iosBuildNumber(3), '1.0.3');
  assert.equal(iosBuildNumber(4), '1.0.4');
  assert.equal(iosBuildNumber(100), '1.1.0');
  assert.equal(iosBuildNumber(10000), '2.0.0');
  for (const bad of ['0', '-1', '1;echo', '1.2', '9999999999999999'])
    assert.throws(() => iosBuildNumber(bad));
});

test('separates stable and beta sources and orders beta.10 ahead of beta.4 by SemVer', () => {
  const entries = [
    entry('v0.1.0-beta.4', '1.0.4'),
    entry('v0.1.0', '1.0.12'),
    entry('v0.1.0-beta.10', '1.0.10'),
    entry('v0.2.0-beta.1', '1.0.13'),
  ];
  assert.deepEqual(
    buildSource(entries, 'stable').apps[0].versions.map((v) => v.marketingVersion),
    ['0.1.0'],
  );
  const beta = buildSource(entries, 'beta');
  assert.deepEqual(
    beta.apps[0].versions.map((v) => v.marketingVersion),
    ['0.2.0-beta.1', '0.1.0', '0.1.0-beta.10', '0.1.0-beta.4'],
  );
  assert.equal(beta.apps[0].versions[0].version, '0.2.0');
  assert.equal(beta.apps[0].versions[0].buildNumber, beta.apps[0].versions[0].buildVersion);
  assert.match(
    beta.apps[0].versions[0].downloadURL,
    /github.com\/lonzzi\/nekofin\/releases\/download/,
  );
});

test('rejects duplicate IPA identities, mismatched artifacts and incomplete metadata', () => {
  assert.throws(
    () => buildSource([entry('v0.1.0-beta.3', '1'), entry('v0.1.0-beta.4', '1')], 'beta'),
    /Repeated IPA/,
  );
  for (const change of [
    { size: 99 },
    { version: '0.2.0' },
    { bundleIdentifier: 'other' },
    { buildVersion: 'beta.4' },
    { appPermissions: null },
  ]) {
    assert.throws(
      () => buildSource([entry('v0.1.0-beta.4', '1.0.4', change)], 'beta'),
      /Invalid source/,
    );
  }
  const draft = entry('v9.0.0', '1');
  draft.release.draft = true;
  assert.deepEqual(buildSource([draft], 'stable').apps, []);
});

test('extracts actual IPA version, build, minimum OS and permissions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nekofin-ios-source-'));
  try {
    const fixture = spawnSync(
      'python3',
      [
        '-c',
        `import plistlib, zipfile, pathlib, sys
p = pathlib.Path(sys.argv[1])
info = {'CFBundleIdentifier':'com.lonzzi.nekofin','CFBundleShortVersionString':'0.1.0','CFBundleVersion':'1.0.4','MinimumOSVersion':'16.4','NSLocalNetworkUsageDescription':'Access media servers'}
with zipfile.ZipFile(p/'app.ipa','w') as z: z.writestr('Payload/NekoFin.app/Info.plist',plistlib.dumps(info))
(p/'app.entitlements').write_bytes(plistlib.dumps({'application-identifier':'TEAM.com.lonzzi.nekofin','keychain-access-groups':['group']}))`,
        directory,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    const script = resolve('.github/scripts/ios-source-metadata.py');
    const output = join(directory, 'metadata.json');
    const result = spawnSync(
      'python3',
      [
        script,
        join(directory, 'app.ipa'),
        'v0.1.0-beta.4',
        output,
        '--entitlements',
        join(directory, 'app.entitlements'),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const metadata = JSON.parse(readFileSync(output));
    assert.equal(metadata.buildVersion, '1.0.4');
    assert.deepEqual(metadata.appPermissions.entitlements, ['keychain-access-groups']);
    assert.equal(
      metadata.appPermissions.privacy.NSLocalNetworkUsageDescription,
      'Access media servers',
    );
    assert.notEqual(
      spawnSync('python3', [script, join(directory, 'app.ipa'), 'v0.2.0-beta.4', output]).status,
      0,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('publishes catalogs only after collecting every release and validating the complete metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nekofin-source-publish-'));
  const originalPath = process.env.PATH;
  const originalCwd = process.cwd();
  try {
    const first = entry('v0.1.0-beta.3', '1.0.3');
    const second = entry('v0.1.0-beta.4', '1.0.4');
    for (const item of [first, second])
      item.release.assets.push({
        name: `nekofin-${item.release.tag_name}-ios-source.json`,
        state: 'uploaded',
      });
    const data = join(directory, 'data.json');
    writeFileSync(data, JSON.stringify([first, second]));
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const mock = `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);const entries=JSON.parse(fs.readFileSync(${JSON.stringify(data)}));
fs.appendFileSync(${JSON.stringify(join(directory, 'calls.jsonl'))},JSON.stringify(args)+'\\n');
if(args[0]==='api'){ if(args.includes('--repo')) process.exit(3); console.log(JSON.stringify(entries.map(e=>[e.release]))); }
else if(args[1]==='download'){const e=entries.find(e=>e.release.tag_name===args[2]);fs.writeFileSync(args[args.indexOf('--output')+1],JSON.stringify(e.metadata));}
`;
    writeFileSync(join(bin, 'gh'), mock, { mode: 0o755 });
    process.env.PATH = `${bin}:${originalPath}`;
    process.chdir(directory);
    publishSources('out');
    const calls = readFileSync(join(directory, 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert(calls[0].includes('--paginate'));
    assert.equal(calls.filter((args) => args[1] === 'download').length, 2);
    assert.deepEqual(
      JSON.parse(readFileSync('out/beta.json')).apps[0].versions.map((v) => v.buildVersion),
      ['1.0.4', '1.0.3'],
    );
    assert(calls.some((args) => args[1] === 'upload' && args.includes('--clobber')));
    assert(calls.at(-1).includes('--draft=false'));
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
