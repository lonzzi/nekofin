import { Buffer } from 'node:buffer';
import { randomUUID, verify } from 'node:crypto';

export const REPOSITORY = 'lonzzi/nekofin';
export const CATALOG_URL = `https://github.com/${REPOSITORY}/releases/download/ota-catalog/catalog.json`;
export const BACKUP_CATALOG_URL = `https://github.com/${REPOSITORY}/releases/download/ota-catalog/catalog-backup.json`;
export const SIGNING_KEY_ID = 'main';
export const CNB_CATALOG_URL =
  'https://cnb.cool/lonzzi/nekofin/-/releases/download/ota-catalog/catalog.json';
export const CNB_BACKUP_CATALOG_URL =
  'https://cnb.cool/lonzzi/nekofin/-/releases/download/ota-catalog/catalog-backup.json';

const headers = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'expo-manifest-filters': '',
  'expo-server-defined-headers': '',
  'cache-control': 'private, no-store',
  vary: 'Expo-Extra-Params',
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

function validAsset(asset, source) {
  if (!asset || !/^[A-Za-z0-9_-]{43}$/.test(asset.hash) || typeof asset.key !== 'string')
    return false;
  if (!asset.key || typeof asset.contentType !== 'string' || /[\r\n]/.test(asset.contentType))
    return false;
  try {
    const url = new URL(asset.url);
    return (
      url.origin === (source === 'cnb' ? 'https://cnb.cool' : 'https://github.com') &&
      url.pathname.startsWith(
        `/${REPOSITORY}/${source === 'cnb' ? '-/' : ''}releases/download/ota-`,
      ) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function validateEntry(
  entry,
  { channel, platform, runtimeVersion, certificate, source = 'github' },
) {
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
      !validAsset(body.launchAsset, source) ||
      !Array.isArray(body.assets) ||
      !body.assets.every((asset) => validAsset(asset, source))
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
  const cachedCatalogs = new Map();
  const fetchingCatalogs = new Map();

  async function loadCatalog(source) {
    const cached = cachedCatalogs.get(source);
    if (cached && now() - cached.at >= 0 && now() - cached.at < 60_000) return cached.value;
    if (fetchingCatalogs.has(source)) return fetchingCatalogs.get(source);
    const fetching = (async () => {
      const options = {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      };
      const primary = source === 'cnb' ? CNB_CATALOG_URL : CATALOG_URL;
      const backup = source === 'cnb' ? CNB_BACKUP_CATALOG_URL : BACKUP_CATALOG_URL;
      let response = await fetcher(`${primary}?v=${Math.floor(now() / 60_000)}`, options);
      if (response.status === 404) {
        response = await fetcher(`${backup}?v=${Math.floor(now() / 60_000)}`, options);
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
      cachedCatalogs.set(source, { value: catalog, at: now() });
      return catalog;
    })();
    fetchingCatalogs.set(source, fetching);
    try {
      return await fetching;
    } finally {
      fetchingCatalogs.delete(source);
    }
  }

  return async (request) => {
    if (request.method !== 'GET') return reply(405, 'Method not allowed', { Allow: 'GET' });
    if (request.headers.get('expo-protocol-version') !== '1')
      return reply(406, 'Unsupported protocol');
    const platform = request.headers.get('expo-platform');
    const runtimeVersion = request.headers.get('expo-runtime-version');
    const channel = request.headers.get('expo-channel-name');
    const sourceParameters = (request.headers.get('expo-extra-params') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^nekofin-source\s*=/.test(value));
    const sourceMatch =
      sourceParameters.length === 1
        ? /^nekofin-source\s*=\s*(?:"(github|cnb)"|(github|cnb))$/.exec(sourceParameters[0])
        : null;
    if (sourceParameters.length && (!sourceMatch || sourceParameters.length !== 1))
      return reply(400, 'Invalid update source');
    const source = sourceMatch?.[1] ?? sourceMatch?.[2] ?? 'github';
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
      const catalog = await loadCatalog(source);
      const entry = catalog.entries[`${channel}/${platform}/${runtimeVersion}`];
      const noUpdate = () =>
        accepts(accept, 'multipart/mixed')
          ? reply(204)
          : reply(406, 'Multipart required for directives');
      if (!entry) return noUpdate();
      const body = validateEntry(entry, { channel, platform, runtimeVersion, certificate, source });
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
