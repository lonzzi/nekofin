import { expect, it } from 'vitest';

import { getBuildRuntimeVersion, getOtaChannel, validateOtaURL } from '../config/ota';
import { resolveInstalledRelease } from './appUpdates';
import { getNativeReleaseTag, isProductionBuild } from './otaConfig';

it('pins installer builds to the published runtime and fingerprints ordinary builds', () => {
  expect(getBuildRuntimeVersion(undefined)).toEqual({ policy: 'fingerprint' });
  expect(getBuildRuntimeVersion('')).toEqual({ policy: 'fingerprint' });
  for (const length of [40, 64]) {
    const runtime = 'a'.repeat(length);
    expect(getBuildRuntimeVersion(runtime)).toBe(runtime);
  }
  for (const invalid of ['fingerprint', 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40)]) {
    expect(() => getBuildRuntimeVersion(invalid)).toThrow(/NEKOFIN_NATIVE_RUNTIME/);
  }
});

it('preserves installation identity from the native channel across OTA config changes', () => {
  const channel = getOtaChannel('production', 'v0.1.0-beta.1', '0.1.0');
  expect(resolveInstalledRelease('0.1.0', getNativeReleaseTag(channel))).toBe('0.1.0-beta.1');
  expect(getOtaChannel('preview', null, '0.1.0')).toBe('preview-v0.1.0');
  expect(getNativeReleaseTag(null)).toBeUndefined();
});

it('only permits HTTPS update endpoints without credentials', () => {
  expect(validateOtaURL('')).toBeNull();
  expect(validateOtaURL('https://updates.example/api/manifest')).toBe(
    'https://updates.example/api/manifest',
  );
  for (const value of [
    'http://updates.example',
    'https://secret@updates.example',
    'https://updates.example?token=secret',
  ]) {
    expect(() => validateOtaURL(value)).toThrow();
  }
});

it('uses the native channel for production checks even when an IPA is resigned or OTA changes app config', () => {
  expect(isProductionBuild('production-v0.1.0-beta.1', 'preview')).toBe(true);
  expect(isProductionBuild('preview-v0.1.0-beta.1', 'production')).toBe(false);
  expect(isProductionBuild(null, 'production')).toBe(true);
});
