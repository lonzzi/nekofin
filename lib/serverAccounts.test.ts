import type { MediaServerInfo } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  assertSameServerAccount,
  getActiveServerAccounts,
  groupServerAccounts,
  isSameMediaServer,
  selectServerAccountIds,
} from './serverAccounts';

const first: MediaServerInfo = {
  id: 'account-1',
  type: 'jellyfin',
  remoteServerId: 'nas',
  address: 'https://nas.test',
  name: 'NAS',
  userId: 'user-1',
  username: 'one',
  accessToken: 'token-1',
  userAvatar: '',
  createdAt: 1,
};
const second = {
  ...first,
  id: 'account-2',
  userId: 'user-2',
  username: 'two',
  accessToken: 'token-2',
  address: 'http://nas.local:8096',
};
const other = { ...first, id: 'other', remoteServerId: 'other-nas', address: 'https://other.test' };

describe('server account selection', () => {
  it('groups accounts by remote server identity across different addresses', () => {
    expect(groupServerAccounts([first, second, other])).toEqual([[first, second], [other]]);
    expect(isSameMediaServer(first, { ...second, type: 'emby' })).toBe(false);
    expect(isSameMediaServer(first, { ...second, remoteServerId: 'another' })).toBe(false);
  });

  it('recognizes legacy accounts by saved addresses without mixing known identities', () => {
    const legacy = {
      ...second,
      remoteServerId: undefined,
      connections: [{ id: 'wan', name: 'WAN', address: first.address }],
    };
    expect(groupServerAccounts([legacy, first, { ...other, address: first.address }])).toEqual([
      [legacy, first],
      [{ ...other, address: first.address }],
    ]);
  });

  it('aggregates only the selected account per server and restores a saved choice', () => {
    const servers = [first, second, other];
    expect(getActiveServerAccounts(servers, [])).toEqual([first, other]);
    const selected = selectServerAccountIds(servers, [], second);
    expect(getActiveServerAccounts(servers, JSON.parse(JSON.stringify(selected)))).toEqual([
      second,
      other,
    ]);
    expect(first.accessToken).toBe('token-1');
    expect(second.accessToken).toBe('token-2');
    expect(
      getActiveServerAccounts(servers, selectServerAccountIds(servers, selected, other)),
    ).toEqual([second, other]);
  });

  it('falls back to a remaining account when the selected one is removed', () => {
    expect(getActiveServerAccounts([first, other], ['account-2', 'missing'])).toEqual([
      first,
      other,
    ]);
    expect(getActiveServerAccounts([], ['account-2'])).toEqual([]);
  });

  it('allows reauthentication but rejects changing user or server in place', () => {
    expect(() =>
      assertSameServerAccount(first, { ...first, accessToken: 'new-token' }),
    ).not.toThrow();
    expect(() => assertSameServerAccount(first, second)).toThrow('原账号');
    expect(() => assertSameServerAccount(first, { ...first, remoteServerId: 'another' })).toThrow(
      '原账号',
    );
  });
});
