import { describe, expect, it } from 'vitest';

import {
  ADD_SERVER_MENU_ACTIONS,
  ADD_SERVER_TOOLBAR_ACTION,
  DETAIL_TOOLBAR_STATES,
  getAddServerSavePresentation,
  NATIVE_HEADER_ACTIONS,
} from './nativeHeaderModel';

describe('native header model', () => {
  it('describes server navigation actions for native toolbars', () => {
    expect(NATIVE_HEADER_ACTIONS.serverLibrary).toEqual([
      {
        androidDrawable: 'search',
        iosIcon: 'magnifyingglass',
        key: 'search',
        label: '服务器内搜索',
        route: '/(tabs)/(servers)/server-search',
      },
      {
        androidDrawable: 'heart',
        iosIcon: 'heart',
        key: 'favorites',
        label: '收藏',
        route: '/(tabs)/(servers)/favorites',
      },
    ]);

    expect(NATIVE_HEADER_ACTIONS.favorites).toEqual([
      {
        androidDrawable: 'film',
        iosIcon: 'film',
        key: 'library',
        label: '媒体库',
        route: '/(tabs)/(servers)/library',
      },
      {
        androidDrawable: 'search',
        iosIcon: 'magnifyingglass',
        key: 'search',
        label: '服务器内搜索',
        route: '/(tabs)/(servers)/server-search',
      },
    ]);
  });

  it('describes each detail toolbar state explicitly', () => {
    expect(DETAIL_TOOLBAR_STATES).toEqual({
      favorite: {
        off: {
          androidDrawable: 'heartOutline',
          iosIcon: 'heart',
          label: '添加收藏',
        },
        on: {
          androidDrawable: 'heart',
          iosIcon: 'heart.fill',
          label: '取消收藏',
        },
      },
      watched: {
        off: {
          androidDrawable: 'checkmarkCircleOutline',
          iosIcon: 'checkmark.circle',
          label: '标记为已观看',
        },
        on: {
          androidDrawable: 'checkmarkCircle',
          iosIcon: 'checkmark.circle.fill',
          label: '标记为未观看',
        },
      },
    });
  });

  it('describes the native add-server menu and save state', () => {
    expect(ADD_SERVER_TOOLBAR_ACTION).toEqual({
      androidDrawable: 'add',
      iosIcon: 'plus',
      label: '添加媒体账号',
    });
    expect(ADD_SERVER_MENU_ACTIONS).toEqual([
      { key: 'jellyfin', label: 'Jellyfin' },
      { key: 'emby', label: 'Emby' },
    ]);
    expect(getAddServerSavePresentation(false)).toEqual({
      accessibilityLabel: '保存服务器',
      disabled: false,
      label: '保存',
    });
    expect(getAddServerSavePresentation(true)).toEqual({
      accessibilityLabel: '正在保存服务器',
      disabled: true,
      label: '保存中…',
    });
  });
});
