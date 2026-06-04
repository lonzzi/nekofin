import { AddServerForm } from '@/components/AddServerForm';
import { AvatarImage } from '@/components/AvatarImage';
import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import { ServerAccountBanner } from '@/components/media-server/ServerAccountBanner';
import PageScrollView from '@/components/PageScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Section } from '@/components/ui/Section';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaServerInfo } from '@/services/media/types';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

export default function MediaScreen() {
  const { servers, removeServer, setCurrentServer, currentServer } = useMediaServers();
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [isAddServerVisible, setIsAddServerVisible] = useState(false);

  const handleAddServer = () => {
    setIsAddServerVisible(true);
    bottomSheetRef.current?.present();
  };

  const handleCloseAddServer = () => {
    setIsAddServerVisible(false);
    bottomSheetRef.current?.dismiss();
  };

  const handleRemoveServer = async (server: MediaServerInfo) => {
    Alert.alert('删除媒体账号', `从 Nekofin 移除 ${server.name} / ${server.username}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void removeServer(server.id);
        },
      },
    ]);
  };

  const handleSetCurrentServer = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      setCurrentServer(server);
    }
  };

  const renderServerItem = (server: MediaServerInfo) => {
    const isCurrentServer = currentServer?.id === server.id;
    return (
      <SettingsRow
        key={server.id}
        title={server.name}
        subtitle={`${server.type.toUpperCase()} - ${server.username}\n${server.address}`}
        icon={server.userAvatar ? undefined : 'link'}
        onPress={() => handleSetCurrentServer(server.id)}
        leftComponent={
          server.userAvatar ? (
            <AvatarImage
              avatarUri={server.userAvatar}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                marginRight: 12,
              }}
            />
          ) : undefined
        }
        rightComponent={
          <ThemedText style={[styles.statusText, isCurrentServer && styles.statusTextActive]}>
            {isCurrentServer ? '当前' : '切换'}
          </ThemedText>
        }
        showArrow={false}
        menuTitle="媒体账号"
        menuActions={[
          { id: 'use', title: '设为当前账号' },
          { id: 'config', title: '连接配置' },
          { id: 'remove', title: '删除账号' },
        ]}
        onMenuAction={(actionId) => {
          if (actionId === 'use') {
            handleSetCurrentServer(server.id);
            return;
          }
          if (actionId === 'config') {
            router.push({
              pathname: '/server-config/[serverId]',
              params: { serverId: server.id },
            });
            return;
          }
          if (actionId === 'remove') {
            handleRemoveServer(server);
          }
        }}
      />
    );
  };

  return (
    <PageScrollView style={styles.container}>
      <View style={styles.workspace}>
        <ServerAccountBanner
          currentServer={currentServer}
          servers={servers}
          onSelectServer={handleSetCurrentServer}
          compact
        />
        <View style={styles.workspaceActions}>
          <SettingsRow
            title="添加 Jellyfin / Emby 账号"
            subtitle="连接一个新的媒体库用户"
            icon="add-circle"
            onPress={handleAddServer}
          />
        </View>
      </View>

      {servers.length > 0 ? (
        <Section title="账号与后端">{servers.map((server) => renderServerItem(server))}</Section>
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>还没有媒体账号</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            添加 Jellyfin 或 Emby 账号后，首页会按当前账号展示继续观看、媒体库和收藏。
          </ThemedText>
          <SettingsRow title="添加第一个账号" icon="add" onPress={handleAddServer} />
        </View>
      )}

      {currentServer ? (
        <Section title="当前账号">
          <SettingsRow
            title="连接配置"
            subtitle={`${currentServer.type.toUpperCase()} - ${currentServer.address}`}
            icon="server"
            onPress={() =>
              router.push({
                pathname: '/server-config/[serverId]',
                params: { serverId: currentServer.id },
              })
            }
          />
        </Section>
      ) : null}

      <BottomSheetBackdropModal ref={bottomSheetRef} onDismiss={() => setIsAddServerVisible(false)}>
        {isAddServerVisible && <AddServerForm onClose={handleCloseAddServer} />}
      </BottomSheetBackdropModal>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  workspace: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  workspaceActions: {
    borderRadius: 24,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  emptyContainer: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.55,
  },
  statusTextActive: {
    opacity: 1,
  },
});
