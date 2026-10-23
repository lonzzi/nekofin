import { resources, t } from '@/lib/i18n';
import type { MediaServerConnection } from '@/services/media/types';

const defaultNames = new Set<string>(
  Object.values(resources).map(({ translation }) => translation['server.defaultConnection']),
);
const alternativeNames = new Set<string>(
  Object.values(resources).map(({ translation }) => translation['server.alternativeConnection']),
);

/** Only recognize legacy automatic IDs paired with a bundled default label. */
export function normalizeConnectionName(line: MediaServerConnection): MediaServerConnection {
  if (line.nameKind) return line;
  if (
    (line.id === 'default' || /^default-https?:\/\//.test(line.id)) &&
    defaultNames.has(line.name)
  )
    return { ...line, name: '', nameKind: 'default' };
  if (/^address-https?:\/\//.test(line.id) && alternativeNames.has(line.name))
    return { ...line, name: '', nameKind: 'alternative' };
  return line;
}

export function getConnectionName(connection: MediaServerConnection) {
  const line = normalizeConnectionName(connection);
  if (line.nameKind === 'default') return t('server.defaultConnection');
  if (line.nameKind === 'alternative') return t('server.alternativeConnection');
  return line.name;
}
