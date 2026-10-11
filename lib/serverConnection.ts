/** A complete URL keeps its port/path; only a bare host receives Jellyfin's default port. */
export function buildConnectionAddress(input: string, port = '', path = '') {
  const raw = input.trim();
  if (!raw) throw new Error('请输入服务器地址');
  const explicit = /^https?:\/\//i.test(raw);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !explicit)
    throw new Error('请使用 HTTP 或 HTTPS 地址');
  let url: URL;
  try {
    url = new URL(explicit ? raw : `http://${raw}`);
  } catch {
    throw new Error('服务器地址格式不正确');
  }
  if (!url.hostname || url.username || url.password || url.search || url.hash)
    throw new Error('请输入不含账号、查询参数或片段的服务器地址');
  if (port.trim()) {
    const n = Number(port);
    if (!/^\d+$/.test(port.trim()) || n < 1 || n > 65535) throw new Error('端口应为 1–65535');
    url.port = String(n);
  } else if (!explicit && !url.port) url.port = '8096';
  if (path.trim()) url.pathname = `/${path.trim().replace(/^\/+|\/+$/g, '')}`;
  return url.toString().replace(/\/+$/, '');
}
