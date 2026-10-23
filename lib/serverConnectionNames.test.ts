import { i18n } from '@/lib/i18n';
import type { MediaServerConnection } from '@/services/media/types';
import { afterEach, describe, expect, it } from 'vitest';

import { getConnectionName, normalizeConnectionName } from './serverConnectionNames';
import { getServerConnections } from './serverConnections';

afterEach(() => i18n.changeLanguage('zh-Hans'));

describe('generated connection names', () => {
  it.each(['默认线路', 'Default connection'])(
    'migrates a legacy automatic default named %s without changing connection identity',
    async (name) => {
      const legacy = { id: 'default', name, address: 'https://nas.test' };
      const [line] = getServerConnections({ address: legacy.address, connections: [legacy] });
      expect(line).toEqual({ ...legacy, name: '', nameKind: 'default' });
      expect(getConnectionName(line)).toBe('默认线路');
      await i18n.changeLanguage('en');
      expect(getConnectionName(line)).toBe('Default connection');
      expect(legacy.name).toBe(name);
    },
  );

  it.each(['备用线路', 'Alternative connection'])(
    'migrates a legacy automatic alternative named %s',
    async (name) => {
      const legacy = {
        id: 'address-https://remote.test',
        name,
        address: 'https://remote.test',
      };
      const line = normalizeConnectionName(legacy);
      expect(line).toEqual({ ...legacy, name: '', nameKind: 'alternative' });
      await i18n.changeLanguage('en');
      expect(getConnectionName(line)).toBe('Alternative connection');
    },
  );

  it('leaves user names intact, including explicit names matching built-in labels', async () => {
    const lines: MediaServerConnection[] = [
      { id: 'default', name: '家中 Wi-Fi', address: 'http://nas.local' },
      { id: 'line-123', name: '备用线路', address: 'https://nas.test' },
      { id: 'default', name: '默认线路', nameKind: 'custom', address: 'https://nas.test' },
      {
        id: 'address-https://nas.test',
        name: 'Alternative connection',
        nameKind: 'custom',
        address: 'https://nas.test',
      },
    ];
    for (const language of ['en', 'zh-Hans']) {
      await i18n.changeLanguage(language);
      for (const line of lines) {
        expect(normalizeConnectionName(line)).toBe(line);
        expect(getConnectionName(line)).toBe(line.name);
      }
    }
  });
});
