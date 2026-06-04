import { ServerAccountBanner } from '@/components/media-server/ServerAccountBanner';
import PageScrollView from '@/components/PageScrollView';
import { Section } from '@/components/ui/Section';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { ThemePreference, useThemePreference } from '@/lib/contexts/ThemePreferenceContext';
import Constants from 'expo-constants';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { servers, currentServer, setCurrentServer } = useMediaServers();
  const { themePreference, setThemePreference } = useThemePreference();

  const router = useRouter();

  const themeLabels: Record<ThemePreference, string> = {
    system: '系统',
    light: '浅色',
    dark: '暗色',
  };

  const themeMenuActions = [
    { id: 'system', title: '系统' },
    { id: 'light', title: '浅色' },
    { id: 'dark', title: '暗色' },
  ];

  const SettingItem = (props: React.ComponentProps<typeof SettingsRow>) => (
    <SettingsRow {...props} />
  );

  const handleServerSelect = (serverId: string) => {
    const server = servers.find((item) => item.id === serverId);
    if (server) {
      setCurrentServer(server);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerLargeTitle: true,
    });
  }, [navigation]);

  return (
    <PageScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.accountBanner}>
        <ServerAccountBanner
          currentServer={currentServer}
          servers={servers}
          onSelectServer={handleServerSelect}
          onManageServers={() => router.push('/media')}
          compact
        />
      </View>

      <Section title="媒体账号">
        <SettingItem
          title="账号与后端"
          subtitle={
            currentServer
              ? `${servers.length} 个账号 - 当前为 ${currentServer.username}`
              : `${servers.length} 个账号`
          }
          icon="list"
          onPress={() => router.push('/media')}
        />
      </Section>

      <Section title="播放">
        <SettingItem title="转码设置" icon="settings" onPress={() => router.push('/transcoding')} />
        <SettingItem
          title="弹幕设置"
          icon="chatbubble-ellipses"
          onPress={() => router.push('/danmaku')}
        />
      </Section>

      <Section title="外观">
        <SettingItem
          title="主题"
          subtitle={themeLabels[themePreference]}
          icon="color-palette"
          showArrow={false}
          menuTitle="选择主题"
          menuActions={themeMenuActions}
          onMenuAction={(actionId) => setThemePreference(actionId as ThemePreference)}
        />
      </Section>

      <Section title="关于">
        <SettingItem
          title="版本信息"
          subtitle={`nekofin v${Constants.expoConfig?.version || '1.0.0'}`}
          icon="information-circle"
          showArrow={false}
        />
        <SettingItem title="开源协议" subtitle="MPL-2.0 License" icon="code" showArrow={false} />
      </Section>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  accountBanner: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
});
