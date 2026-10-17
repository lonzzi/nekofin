import { Buffer } from 'node:buffer';
import { randomUUID, verify } from 'node:crypto';

export const REPOSITORY = 'lonzzi/nekofin';
export const CATALOG_URL = `https://github.com/${REPOSITORY}/releases/download/ota-catalog/catalog.json`;
export const BACKUP_CATALOG_URL = `https://github.com/${REPOSITORY}/releases/download/ota-catalog/catalog-backup.json`;
export const SIGNING_KEY_ID = 'main';

const headers = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'expo-manifest-filters': '',
  'expo-server-defined-headers': '',
  'cache-control': 'private, no-store',
};

function reply(status, body = null, extraHeaders = {}) {
  return new Response(body, { status, headers: { ...headers, ...extraHeaders } });
}

function accepts(header, type) {
  return header.split(',').some((item) => {
    const [mediaType, ...parameters] = item.trim().split(';');
    const q = parameters.map((value) => value.trim()).find((value) => value.startsWith('q='));
    return (mediaType === type || mediaType === '*/*') && (!q || Number(q.slice(2)) > 0);
  });
}

function multipartReply(name, body, signature) {
  const boundary = `expo-${randomUUID()}`;
  const multipart = `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\ncontent-type: application/json\r\nexpo-signature: ${signature}\r\n\r\n${body}\r\n--${boundary}--\r\n`;
  return reply(200, multipart, { 'content-type': `multipart/mixed; boundary=${boundary}` });
}

function validAsset(asset) {
  if (!asset || !/^[A-Za-z0-9_-]{43}$/.test(asset.hash) || typeof asset.key !== 'string')
    return false;
  if (!asset.key || typeof asset.contentType !== 'string' || /[\r\n]/.test(asset.contentType))
    return false;
  try {
    const url = new URL(asset.url);
    return (
      url.origin === 'https://github.com' &&
      url.pathname.startsWith(`/${REPOSITORY}/releases/download/ota-`) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function validateEntry(entry, { channel, platform, runtimeVersion, certificate }) {
  if (!entry || typeof entry.body !== 'string' || typeof entry.signature !== 'string') {
    throw new Error('Invalid catalog entry');
  }
  if (
    !verify(
      'RSA-SHA256',
      Buffer.from(entry.body),
      certificate,
      Buffer.from(entry.signature, 'base64'),
    )
  ) {
    throw new Error('Invalid catalog signature');
  }
  const body = JSON.parse(entry.body);
  if (entry.kind === 'update') {
    if (
      body.runtimeVersion !== runtimeVersion ||
      body.metadata?.channel !== channel ||
      body.metadata?.platform !== platform ||
      !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.id) ||
      !Number.isFinite(Date.parse(body.createdAt)) ||
      !validAsset(body.launchAsset) ||
      !Array.isArray(body.assets) ||
      !body.assets.every(validAsset)
    ) {
      throw new Error('Incompatible update manifest');
    }
  } else if (entry.kind === 'rollback') {
    if (
      body.type !== 'rollBackToEmbedded' ||
      !Number.isFinite(Date.parse(body.parameters?.commitTime)) ||
      body.parameters.channel !== channel ||
      body.parameters.platform !== platform ||
      body.parameters.runtimeVersion !== runtimeVersion
    ) {
      throw new Error('Invalid rollback directive');
    }
  } else {
    throw new Error('Unknown update entry');
  }
  return body;
}

export function createUpdateHandler({ certificate, fetcher = fetch, now = Date.now }) {
  let cachedCatalog = null;
  let cachedAt = 0;
  let fetching = null;

  async function loadCatalog() {
    if (cachedCatalog && now() - cachedAt >= 0 && now() - cachedAt < 60_000) return cachedCatalog;
    if (fetching) return fetching;
    fetching = (async () => {
      const options = {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      };
      let response = await fetcher(`${CATALOG_URL}?v=${Math.floor(now() / 60_000)}`, options);
      if (response.status === 404) {
        response = await fetcher(`${BACKUP_CATALOG_URL}?v=${Math.floor(now() / 60_000)}`, options);
      }
      if (response.status === 404) return { version: 1, entries: {} };
      if (!response.ok) throw new Error('Catalog unavailable');
      const text = await response.text();
      if (text.length > 4_000_000) throw new Error('Catalog too large');
      const catalog = JSON.parse(text);
      if (
        catalog.version !== 1 ||
        !catalog.entries ||
        typeof catalog.entries !== 'object' ||
        Array.isArray(catalog.entries)
      ) {
        throw new Error('Invalid catalog');
      }
      cachedCatalog = catalog;
      cachedAt = now();
      return catalog;
    })();
    try {
      return await fetching;
    } finally {
      fetching = null;
    }
  }

  return async (request) => {
    if (request.method !== 'GET') return reply(405, 'Method not allowed', { Allow: 'GET' });
    if (request.headers.get('expo-protocol-version') !== '1')
      return reply(406, 'Unsupported protocol');
    const platform = request.headers.get('expo-platform');
    const runtimeVersion = request.headers.get('expo-runtime-version');
    const channel = request.headers.get('expo-channel-name');
    if (
      !['ios', 'android'].includes(platform) ||
      !/^[a-f0-9]{40,64}$/.test(runtimeVersion ?? '') ||
      !/^(production|preview)-v[0-9A-Za-z.+-]{1,160}$/.test(channel ?? '')
    ) {
      return reply(400, 'Invalid update target');
    }
    const accept = request.headers.get('accept') ?? '*/*';
    if (
      !['application/json', 'application/expo+json', 'multipart/mixed'].some((type) =>
        accepts(accept, type),
      )
    ) {
      return reply(406, 'Unsupported response type');
    }
    try {
      const catalog = await loadCatalog();
      const entry = catalog.entries[`${channel}/${platform}/${runtimeVersion}`];
      const noUpdate = () =>
        accepts(accept, 'multipart/mixed')
          ? reply(204)
          : reply(406, 'Multipart required for directives');
      if (!entry) return noUpdate();
      const body = validateEntry(entry, { channel, platform, runtimeVersion, certificate });
      const signature = `sig="${entry.signature}", keyid="${SIGNING_KEY_ID}", alg="rsa-v1_5-sha256"`;
      if (entry.kind === 'update') {
        if (request.headers.get('expo-current-update-id') === body.id) return noUpdate();
        if (!accepts(accept, 'application/json') && !accepts(accept, 'application/expo+json')) {
          return multipartReply('manifest', entry.body, signature);
        }
        return reply(200, entry.body, {
          'content-type': accepts(accept, 'application/json')
            ? 'application/json'
            : 'application/expo+json',
          'expo-signature': signature,
        });
      }
      if (!accepts(accept, 'multipart/mixed')) return reply(406, 'Multipart required');
      return multipartReply('directive', entry.body, signature);
    } catch {
      // An unavailable or invalid catalog must never replace a working update.
      return reply(503, 'Update service temporarily unavailable', { 'retry-after': '60' });
    }
  };
}
