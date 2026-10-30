import { createAddSourceResponse } from '../lib/add-source.mjs';

export default async function addSource(request, response) {
  const result = createAddSourceResponse(
    new Request(`https://updates.invalid${request.url}`, { method: request.method }),
  );
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(await result.text());
}
