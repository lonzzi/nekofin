import { expect, it } from 'vitest';

import { resolveInstalledRelease } from './appUpdates';
import { getNativeReleaseTag, getOtaChannel, isProductionBuild, validateOtaURL } from './otaConfig';

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
