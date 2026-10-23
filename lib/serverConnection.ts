import { t as tr } from '@/lib/i18n';

/** A complete URL keeps its port/path; only a bare host receives Jellyfin's default port. */
export function buildConnectionAddress(input: string, port = '', path = '') {
  const raw = input.trim();
  if (!raw) throw new Error(tr('server.enterUrl'));
  const explicit = /^https?:\/\//i.test(raw);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !explicit)
    throw new Error(tr('server.httpUrlRequired'));
  let url: URL;
  try {
    url = new URL(explicit ? raw : `http://${raw}`);
  } catch {
    throw new Error(tr('server.invalidUrl'));
  }
  if (!url.hostname || url.username || url.password || url.search || url.hash)
    throw new Error(tr('server.urlCredentialsNotAllowed'));
  if (port.trim()) {
    const n = Number(port);
    if (!/^\d+$/.test(port.trim()) || n < 1 || n > 65535) throw new Error(tr('server.invalidPort'));
    url.port = String(n);
  } else if (!explicit && !url.port) url.port = '8096';
  if (path.trim()) url.pathname = `/${path.trim().replace(/^\/+|\/+$/g, '')}`;
  return url.toString().replace(/\/+$/, '');
}
