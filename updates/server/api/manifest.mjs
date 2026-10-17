import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';

import { createUpdateHandler } from '../lib/protocol.mjs';

const certificate = readFileSync(new URL('../ota-certificate.crt', import.meta.url), 'utf8');
const handler = createUpdateHandler({ certificate });

export default async function manifest(request, response) {
  const result = await handler(
    new Request(`https://updates.invalid${request.url}`, {
      method: request.method,
      headers: request.headers,
    }),
  );
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}
