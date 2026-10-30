import { createHash } from 'node:crypto';

export function createAddSourceResponse(request) {
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const parameters = new URL(request.url).searchParams;
  const values = { tool: 'altstore', channel: 'beta', source: 'cnb' };
  const allowed = {
    tool: ['altstore', 'livecontainer'],
    channel: ['stable', 'beta'],
    source: ['github', 'cnb'],
  };
  for (const [key, value] of parameters) {
    if (!allowed[key]?.includes(value) || parameters.getAll(key).length !== 1)
      return new Response('Invalid source link', { status: 400 });
    values[key] = value;
  }
  const { tool, channel, source } = values;
  const toolName = tool === 'altstore' ? 'AltStore Classic' : 'LiveContainer';
  const channelName = channel === 'beta' ? 'Beta' : 'Stable';
  const providerName = source === 'cnb' ? 'CNB' : 'GitHub';
  const root =
    source === 'cnb'
      ? 'https://cnb.cool/lonzzi/nekofin/-/releases/download'
      : 'https://github.com/lonzzi/nekofin/releases/download';
  const sourceURL = `${root}/app-sources/${channel}.json`;
  const link = `${tool}://source?url=${encodeURIComponent(sourceURL)}`;
  const script = `if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) location.href = ${JSON.stringify(link)};`;
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const html = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NekoFin · ${toolName}</title>
<style>
:root { color-scheme: light dark; font: 16px/1.6 system-ui, sans-serif; background: #f4f5f7; color: #17212b; }
body { max-width: 560px; margin: 12vh auto; padding: 24px; }
main { background: white; padding: 32px; border-radius: 22px; box-shadow: 0 8px 40px #17212b0a; }
h1 { font-size: 30px; margin: 0 0 8px; } p { margin: 12px 0 24px; }
.label { color: #647282; font-size: 14px; } .button { display: block; padding: 14px 20px; border-radius: 12px; background: #1559c5; color: white; text-decoration: none; text-align: center; font-weight: 600; }
details { margin-top: 28px; } summary { cursor: pointer; } .url { display: block; overflow-wrap: anywhere; margin-top: 12px; color: inherit; font: 13px/1.6 ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root { background: #111519; color: #e7edf4; } main { background: #1c232b; } .label { color: #abb7c5; } .button { background: #377be1; } }
</style>
<main><div class="label">NekoFin · ${channelName} · ${providerName}</div>
<h1>添加到 ${toolName}</h1>
<p>请在已安装 ${toolName} 的 iPhone 或 iPad 上打开。<br><span class="label">Open on an iPhone or iPad with ${toolName} installed.</span></p>
<a class="button" href="${link}">添加源 / Add source</a>
<details><summary>没有打开？复制源地址 / Copy source URL</summary><a class="url" href="${sourceURL}">${sourceURL}</a></details>
</main><script>${script}</script></html>`;
  return new Response(request.method === 'HEAD' ? null : html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'`,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}
