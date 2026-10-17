const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseAndroidRuntime,
  resolveRuntimeValue,
  assertRuntime,
} = require('./verify-native-runtime.cjs');

const expected = 'f742682830114e6ba45dbd2d3b2af48efb86806e';
const built = '4f0bbe6ed0775989f0f7b9848fa5dbe579b89033';
const manifest = (value) => `E: manifest
  E: application
    E: meta-data
      A: android:name(0x01010003)="expo.modules.updates.EXPO_RUNTIME_VERSION"
      A: android:value(0x01010024)=${value}
    E: meta-data
      A: android:name(0x01010003)="another.value"`;

test('reads a literal runtime without resolving an unused fingerprint file', () => {
  const value = parseAndroidRuntime(manifest(`"${expected}"`), '');
  assert.equal(
    resolveRuntimeValue(value, () => {
      throw new Error('unused');
    }),
    expected,
  );
});

test('resolves a compiled string reference and ignores unrelated string values', () => {
  const resources = `spec resource 0x7f1200ac app:string/expo_runtime_version:
    resource 0x7f1200ab app:string/other:
      (string8) "${built}"
    resource 0x7f1200ac app:string/expo_runtime_version:
      (string8) "${expected}"`;
  assert.equal(parseAndroidRuntime(manifest('@0x7f1200ac'), resources), expected);
});

test('reads the actual fingerprint file when native config uses the Expo sentinel', () => {
  const value = parseAndroidRuntime(manifest('"file:fingerprint"'), '');
  const actual = resolveRuntimeValue(value, () => `${built}\n`);
  assert.equal(actual, built);
  assert.throws(() => assertRuntime(actual, expected), /does not match release runtime/);
});

test('fails closed when compiled runtime metadata is missing or unresolved', () => {
  assert.throws(() => parseAndroidRuntime('', ''), /Cannot read/);
  assert.throws(() => parseAndroidRuntime(manifest('@0x7f1200ac'), ''), /Cannot read/);
});

test('accepts only matching native and release runtimes', () => {
  assert.doesNotThrow(() => assertRuntime(expected, expected));
  assert.throws(() => assertRuntime(built, expected), /does not match/);
});
