import { AvatarImage } from '@/components/AvatarImage';
import { ThemedText } from '@/components/ThemedText';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { MediaServerInfo } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type ServerAccountBannerProps = {
  currentServer: MediaServerInfo | null;
  servers: MediaServerInfo[];
  onSelectServer?: (serverId: string) => void;
  onManageServers?: () => void;
  compact?: boolean;
};

function getServerTypeLabel(type?: MediaServerInfo['type']) {
  if (type === 'emby') return 'Emby';
  if (!type) return '媒体账号';
  return 'Jellyfin';
}

export function ServerAccountBanner({
  currentServer,
  servers,
  onSelectServer,
  onManageServers,
  compact = false,
}: ServerAccountBannerProps) {
  const { accentColor, secondarySystemGroupedBackground, secondaryTextColor, separatorColor } =
    useSettingsColors();

  const menuActions = useMemo<MenuAction[]>(() => {
    const serverActions: MenuAction[] = servers.map((server) => ({
      id: server.id,
      title: server.name || server.address,
      subtitle: `${getServerTypeLabel(server.type)} - ${server.username}`,
      state: currentServer?.id === server.id ? 'on' : 'off',
    }));

    if (!onManageServers) {
      return serverActions;
    }

    return [
      ...serverActions,
      {
        id: 'manage-servers',
        title: '管理服务器与账号',
      },
    ];
  }, [currentServer?.id, onManageServers, servers]);

  const content = (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: secondarySystemGroupedBackground,
          borderColor: separatorColor,
        },
        compact && styles.compactContainer,
      ]}
      onPress={menuActions.length === 0 ? onManageServers : undefined}
    >
      <View style={styles.identity}>
        {currentServer ? (
          <AvatarImage avatarUri={currentServer.userAvatar} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar, { backgroundColor: accentColor }]}>
            <Ionicons name="server" size={20} color="white" />
          </View>
        )}
        <View style={styles.textColumn}>
          <View style={styles.metaRow}>
            <View style={[styles.typePill, { backgroundColor: `${accentColor}20` }]}>
              <ThemedText style={[styles.typeText, { color: accentColor }]}>
                {getServerTypeLabel(currentServer?.type)}
              </ThemedText>
            </View>
            {currentServer ? (
              <ThemedText style={[styles.username, { color: secondaryTextColor }]}>
                {currentServer.username}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText numberOfLines={1} style={styles.serverName}>
            {currentServer?.name || '选择媒体服务器'}
          </ThemedText>
          <ThemedText numberOfLines={1} style={[styles.address, { color: secondaryTextColor }]}>
            {currentServer?.address || '添加 Jellyfin 或 Emby 账号后开始播放'}
          </ThemedText>
        </View>
      </View>
      <Ionicons name="chevron-expand" size={20} color={secondaryTextColor} />
    </Pressable>
  );

  if (menuActions.length === 0) {
    return content;
  }

  return (
    <MenuView
      isAnchoredToRight
      title="媒体账号"
      actions={menuActions}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === 'manage-servers') {
          onManageServers?.();
          return;
        }
        onSelectServer?.(nativeEvent.event);
      }}
    >
      {content}
    </MenuView>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 88,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactContainer: {
    marginHorizontal: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  username: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  serverName: {
    fontSize: 17,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
  },
});
