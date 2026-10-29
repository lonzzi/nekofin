import { expect, it, vi } from 'vitest';

import { createPlayerExitPreparation } from './playerExitPreparation';

it('waits for native preparation once even if back is pressed repeatedly', async () => {
  let finish!: () => void;
  const native = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const exit = createPlayerExitPreparation();
  exit.register(native);
  const first = exit.prepare();
  expect(exit.prepare()).toBe(first);
  await Promise.resolve();
  expect(native).toHaveBeenCalledOnce();
  const ready = vi.fn();
  void first.then(ready);
  expect(ready).not.toHaveBeenCalled();
  finish();
  await first;
  expect(ready).toHaveBeenCalledOnce();
});

it('does not let cleanup of an old player unregister its replacement', async () => {
  const exit = createPlayerExitPreparation();
  const oldPlayer = vi.fn(async () => {});
  const nextPlayer = vi.fn(async () => {});
  const remove = exit.register(oldPlayer);
  exit.register(nextPlayer);
  remove();
  await exit.prepare();
  expect(oldPlayer).not.toHaveBeenCalled();
  expect(nextPlayer).toHaveBeenCalledOnce();
});

it('can leave a player that has not mounted a native view or already unmounted', async () => {
  const exit = createPlayerExitPreparation();
  const native = vi.fn(async () => {});
  exit.register(native)();
  await expect(exit.prepare()).resolves.toBeUndefined();
  expect(native).not.toHaveBeenCalled();
});

it('propagates preparation failure so navigation can use its normal cleanup fallback', async () => {
  const exit = createPlayerExitPreparation();
  exit.register(async () => {
    throw new Error('native view removed');
  });
  await expect(exit.prepare()).rejects.toThrow('native view removed');
});
