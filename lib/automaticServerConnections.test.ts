import type { MediaServerInfo } from '@/services/media/types';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createAutomaticConnectionMonitor } from './automaticServerConnections';

const server: MediaServerInfo = {
  id: 'nas',
  type: 'jellyfin',
  address: 'https://wan.test',
  name: 'NAS',
  userId: 'user',
  username: 'User',
  accessToken: 'test-token',
  userAvatar: '',
  createdAt: 1,
  remoteServerId: 'nas-1',
  connections: [
    { id: 'wan', name: '外网', address: 'https://wan.test' },
    { id: 'lan', name: '局域网', address: 'http://nas:8096' },
  ],
  connectionPolicy: { enabled: true, defaultConnectionId: 'wan', localConnectionId: 'lan' },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const dependencies = {
    getServers: () => [server],
    readNetwork: vi.fn().mockResolvedValue({ connected: true, wifi: true }),
    isActive: vi.fn().mockReturnValue(true),
    verifyConnection: vi.fn().mockResolvedValue({}),
    switchConnection: vi.fn().mockResolvedValue(undefined),
  };
  return { dependencies, monitor: createAutomaticConnectionMonitor(dependencies) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('debounces repeated OS events and switches using the latest network', async () => {
  const { monitor, dependencies } = setup();
  monitor.schedule();
  await vi.advanceTimersByTimeAsync(300);
  monitor.schedule();
  await vi.advanceTimersByTimeAsync(599);
  expect(dependencies.readNetwork).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(dependencies.switchConnection).toHaveBeenCalledExactlyOnceWith('nas', 'lan', {
    automatic: true,
    isCurrent: expect.any(Function),
  });
  expect(dependencies.switchConnection.mock.calls[0][2].isCurrent()).toBe(true);
  monitor.dispose();
  expect(dependencies.switchConnection.mock.calls[0][2].isCurrent()).toBe(false);
});

it('discards a LAN probe if the user leaves Wi-Fi before it completes', async () => {
  const { monitor, dependencies } = setup();
  const lan = deferred<unknown>();
  dependencies.verifyConnection.mockReturnValue(lan.promise);
  monitor.schedule();
  await vi.advanceTimersByTimeAsync(600);
  dependencies.readNetwork.mockResolvedValue({ connected: true, wifi: false });
  monitor.schedule();
  lan.resolve({});
  await vi.advanceTimersByTimeAsync(0);
  expect(dependencies.switchConnection).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(600);
  expect(dependencies.switchConnection).toHaveBeenCalledExactlyOnceWith(
    'nas',
    'wan',
    expect.any(Object),
  );
  monitor.dispose();
});

it('does not switch after playback begins, backgrounding, or unmount', async () => {
  for (const dispose of [false, true]) {
    const { monitor, dependencies } = setup();
    const lan = deferred<unknown>();
    dependencies.verifyConnection.mockReturnValue(lan.promise);
    monitor.schedule();
    await vi.advanceTimersByTimeAsync(600);
    if (dispose) monitor.dispose();
    else dependencies.isActive.mockReturnValue(false);
    lan.resolve({});
    await vi.advanceTimersByTimeAsync(1000);
    expect(dependencies.switchConnection).not.toHaveBeenCalled();
    monitor.dispose();
  }
});

it('keeps other servers responsive while one LAN address is unreachable', async () => {
  const { monitor, dependencies } = setup();
  const lan = deferred<unknown>();
  dependencies.getServers = () => [server, { ...server, id: 'nas-2' }];
  dependencies.verifyConnection.mockImplementation((item: MediaServerInfo) =>
    item.id === 'nas' ? lan.promise : Promise.resolve({}),
  );
  monitor.schedule();
  await vi.advanceTimersByTimeAsync(600);
  expect(dependencies.switchConnection).toHaveBeenCalledExactlyOnceWith(
    'nas-2',
    'lan',
    expect.any(Object),
  );
  monitor.dispose();
  lan.resolve({});
});
