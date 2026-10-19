import { createElement as el, Fragment } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Content, Item, ItemIcon, ItemTitle, readContextMenu, Trigger } from './contextMenuModel';

describe('Android context menu declarations', () => {
  it('preserves the card trigger and defers media actions until selection', () => {
    const openDetails = vi.fn();
    const play = vi.fn();
    const favorite = vi.fn();
    const trigger = el('card', { onPress: openDetails }, el('play-button', { onPress: play }));
    const menu = readContextMenu([
      el(Trigger, { key: 'trigger' }, trigger),
      el(
        Content,
        { key: 'content' },
        el(
          Item,
          { key: 'play', onSelect: play },
          el(ItemIcon, { ios: { name: 'play.circle' } }),
          el(ItemTitle, null, '播放'),
        ),
        el(
          Item,
          { key: 'addToFavorites', onSelect: favorite },
          el(ItemTitle, null, '收藏'),
          el(ItemIcon, { ios: { name: 'heart' } }),
        ),
      ),
    ]);

    expect(menu.trigger).toBe(trigger);
    expect(menu.entries.map(({ id, title, image }) => ({ id, title, image }))).toEqual([
      { id: 'play', title: '播放', image: 'ic_media_play' },
      { id: 'addToFavorites', title: '收藏', image: 'ic_menu_favorite' },
    ]);
    expect(openDetails).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(favorite).not.toHaveBeenCalled();
    menu.entries.find(({ id }) => id === 'addToFavorites')?.onSelect?.();
    expect(favorite).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves conditional actions for played=%s', (played) => {
    const markPlayed = vi.fn();
    const markUnplayed = vi.fn();
    const menu = readContextMenu(
      el(
        Fragment,
        null,
        el(
          Content,
          null,
          false,
          null,
          el(
            Fragment,
            null,
            el(
              Item,
              {
                key: played ? 'markAsUnwatched' : 'markAsWatched',
                onSelect: played ? markUnplayed : markPlayed,
              },
              el(ItemIcon, { ios: { name: played ? 'eye.slash' : 'eye' } }),
              el(ItemTitle, null, played ? '标记为未看' : '标记为已看'),
            ),
          ),
        ),
      ),
    );

    expect(menu.entries).toHaveLength(1);
    expect(menu.entries[0]).toMatchObject({
      id: played ? 'markAsUnwatched' : 'markAsWatched',
      title: played ? '标记为未看' : '标记为已看',
      image: played ? 'ic_menu_view_off' : 'ic_menu_view',
    });
    menu.entries[0].onSelect?.();
    expect(played ? markUnplayed : markPlayed).toHaveBeenCalledOnce();
    expect(played ? markPlayed : markUnplayed).not.toHaveBeenCalled();
  });

  it('keeps server icons, destructive removal, and disabled/hidden attributes', () => {
    const removeAccount = vi.fn();
    const menu = readContextMenu(
      el(
        Content,
        null,
        el(
          Item,
          { key: 'accounts', disabled: true },
          el(ItemTitle, null, '管理账号'),
          el(ItemIcon, { ios: { name: 'person.2' }, androidIconName: 'people' }),
        ),
        el(
          Item,
          { key: 'remove', destructive: true, onSelect: removeAccount },
          el(ItemTitle, null, '移除此账号'),
          el(ItemIcon, { ios: { name: 'trash' }, androidIconName: 'delete' }),
        ),
        el(Item, { key: 'hidden', hidden: true }, el(ItemTitle, null, '隐藏操作')),
      ),
    );

    expect(menu.entries[0]).toMatchObject({
      id: 'accounts',
      image: 'ic_menu_person',
      disabled: true,
    });
    expect(menu.entries[1]).toMatchObject({
      id: 'remove',
      image: 'ic_menu_delete',
      destructive: true,
      onSelect: removeAccount,
    });
    expect(menu.entries[2]).toMatchObject({ id: 'hidden', hidden: true });
    expect(removeAccount).not.toHaveBeenCalled();
  });
});
