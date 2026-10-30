import { expect, it } from 'vitest';

import { resolveIosBuildNumber } from '../config/release';
import { getIosSourceLink, getIosUpdateSource } from './iosUpdateSources';

it('keeps beta users on the beta source and stable users on the stable source', () => {
  expect(getIosUpdateSource('0.1.0-beta.3')).toMatch(/\/beta.json$/);
  expect(getIosUpdateSource('0.1.0-rc.1')).toMatch(/\/beta.json$/);
  expect(getIosUpdateSource('0.1.0')).toMatch(/\/stable.json$/);
  for (const tool of ['altstore', 'livecontainer'] as const) {
    const link = new URL(getIosSourceLink(tool, '0.1.0-beta.3'));
    expect(link.protocol).toBe(`${tool}:`);
    expect(link.hostname).toBe('source');
    expect(link.searchParams.get('url')).toBe(getIosUpdateSource('0.1.0-beta.3'));
  }
});
it('rejects build numbers that cannot be written into a valid iOS IPA', () => {
  expect(resolveIosBuildNumber(undefined)).toBe('1');
  expect(resolveIosBuildNumber('1.0.4')).toBe('1.0.4');
  for (const invalid of ['0', 'beta.4', '1.00.4', '1.100.1', '10000', '1.0.4.1'])
    expect(() => resolveIosBuildNumber(invalid)).toThrow();
});

it('adds CNB sources to both sideloading tools without changing the release channel', () => {
  for (const [version, channel] of [
    ['0.1.0-beta.8', 'beta'],
    ['0.1.0', 'stable'],
  ]) {
    const source = `https://cnb.cool/lonzzi/nekofin/-/releases/download/app-sources/${channel}.json`;
    expect(getIosUpdateSource(version, 'cnb')).toBe(source);
    for (const tool of ['altstore', 'livecontainer'] as const)
      expect(new URL(getIosSourceLink(tool, version, 'cnb')).searchParams.get('url')).toBe(source);
  }
});
