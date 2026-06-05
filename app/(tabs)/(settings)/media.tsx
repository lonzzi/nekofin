import { AddServerForm } from '@/components/AddServerForm';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaServerInfo } from '@/services/media/types';
import { BottomSheet } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

export default function MediaScreen() {
  const { servers, removeServer, setCurrentServer, currentServer } = useMediaServers();
  const router = useRouter();

  const [isAddServerVisible, setIsAddServerVisible] = useState(false);

  const handleCloseAddServer = () => {
    setIsAddServerVisible(false);
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

  return (
    <>
      <NativeSettingsForm testID="media-account-settings-form">
        <NativeSettingsSection title="账号与后端">
          <NativeSettingsItem
            title="添加 Jellyfin / Emby 账号"
            subtitle="连接一个新的媒体库用户"
            onPress={() => setIsAddServerVisible(true)}
          />
        </NativeSettingsSection>

        {servers.length > 0 ? (
          <NativeSettingsSection title="账号列表">
            {servers.map((server) => {
              const isCurrentServer = currentServer?.id === server.id;
              return (
                <NativeSettingsItem
                  key={server.id}
                  title={server.name}
                  subtitle={`${server.type.toUpperCase()} - ${server.username}\n${server.address}`}
                  value={isCurrentServer ? '当前' : '切换'}
                  onPress={() => handleSetCurrentServer(server.id)}
                />
              );
            })}
          </NativeSettingsSection>
        ) : (
          <NativeSettingsSection title="账号列表">
            <NativeSettingsItem
              title="还没有媒体账号"
              subtitle="添加 Jellyfin 或 Emby 账号后，首页会按当前账号展示继续观看、媒体库和收藏。"
              onPress={() => setIsAddServerVisible(true)}
            />
          </NativeSettingsSection>
        )}

        {currentServer ? (
          <NativeSettingsSection title="当前账号">
            <NativeSettingsItem
              title="连接配置"
              subtitle={`${currentServer.type.toUpperCase()} - ${currentServer.address}`}
              onPress={() =>
                router.push({
                  pathname: '/server-config/[serverId]',
                  params: { serverId: currentServer.id },
                })
              }
            />
            <NativeSettingsItem
              title="删除当前账号"
              subtitle={`${currentServer.name} / ${currentServer.username}`}
              onPress={() => handleRemoveServer(currentServer)}
            />
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>

      <BottomSheet
        isPresented={isAddServerVisible}
        onDismiss={() => setIsAddServerVisible(false)}
        testID="add-media-account-sheet"
      >
        {isAddServerVisible ? <AddServerForm onClose={handleCloseAddServer} /> : null}
      </BottomSheet>
    </>
  );
}
