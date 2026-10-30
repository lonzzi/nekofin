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
  const root =
    source === 'cnb'
      ? 'https://cnb.cool/lonzzi/nekofin/-/releases/download'
      : 'https://github.com/lonzzi/nekofin/releases/download';
  const sourceURL = `${root}/app-sources/${channel}.json`;
  const scheme = tool === 'altstore' ? 'altstore-classic' : 'livecontainer';
  const link = `${scheme}://source?url=${encodeURIComponent(sourceURL)}`;
  // GitHub strips custom URL schemes. A redirect hands off without rendering a page.
  return new Response(null, {
    status: 302,
    headers: {
      location: link,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
