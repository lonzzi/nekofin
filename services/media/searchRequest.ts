import type { MediaAdapter, SearchItemsParams } from './types';

export const SEARCH_TIMEOUT_MS = 8000;

function searchAbortError() {
  const error = new Error('Search cancelled');
  error.name = 'AbortError';
  return error;
}

/** Bound both transport and response parsing, including providers that ignore cancellation. */
export async function searchWithDeadline(
  adapter: Pick<MediaAdapter, 'searchItems'>,
  params: SearchItemsParams,
): ReturnType<MediaAdapter['searchItems']> {
  const { signal, ...request } = params;
  if (signal?.aborted) throw searchAbortError();
  const controller = new AbortController();
  let interrupt!: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    interrupt = reject;
  });
  const cancel = () => {
    interrupt(searchAbortError());
    controller.abort();
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const deadline = setTimeout(() => {
    const error = new Error('Search timed out');
    error.name = 'TimeoutError';
    interrupt(error);
    controller.abort();
  }, SEARCH_TIMEOUT_MS);
  try {
    const result = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw searchAbortError();
      return adapter.searchItems({ ...request, signal: controller.signal });
    });
    return await Promise.race([result, interrupted]);
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', cancel);
  }
}
