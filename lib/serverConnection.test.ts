import { expect, it } from 'vitest';

import { buildConnectionAddress } from './serverConnection';

it('preserves reverse proxy HTTPS and base paths', () => {
  expect(buildConnectionAddress('https://media.example.com/jellyfin/')).toBe(
    'https://media.example.com/jellyfin',
  );
  expect(buildConnectionAddress('http://nas:8097')).toBe('http://nas:8097');
  expect(buildConnectionAddress('nas')).toBe('http://nas:8096');
  expect(buildConnectionAddress('https://nas', '8443', '/media/')).toBe('https://nas:8443/media');
});
it('rejects invalid schemes and embedded credentials', () => {
  for (const address of ['ftp://nas', 'https://user:pass@nas', 'https://nas?api_key=secret', ''])
    expect(() => buildConnectionAddress(address)).toThrow();
  expect(() => buildConnectionAddress('nas', '99999')).toThrow();
});
