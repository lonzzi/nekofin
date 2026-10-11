import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getServerConnections } from '@/lib/serverConnections';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';

function ServerLinesScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { getServer } = useMediaServers();
  const server = getServer(serverId);
  const router = useRouter();
  return (
    <>
      <OuterScreenOptions title="服务器线路" grouped />
      <NativeSettingsForm>
        <NativeSettingsSection title={server?.name}>
          {server ? (
            getServerConnections(server).map((line) => (
              <NativeSettingsItem
                key={line.id}
                title={<SettingsTitle>{line.name}</SettingsTitle>}
                subtitle={<SettingsSubtitle primary={line.address} lines={3} />}
                value={line.address === server.address ? '当前' : undefined}
                disclosure={line.address !== server.address}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(servers)/server-line/[serverId]',
                    params: { serverId, connectionId: line.id },
                  })
                }
              />
            ))
          ) : (
            <NativeSettingsItem title={<SettingsTitle>服务器不存在</SettingsTitle>} />
          )}
        </NativeSettingsSection>
        {server ? (
          <NativeSettingsSection>
            <NativeSettingsItem
              title={<SettingsTitle>添加线路</SettingsTitle>}
              disclosure
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(servers)/server-line/[serverId]',
                  params: { serverId },
                })
              }
            />
            <NativeSettingsItem
              title={<SettingsTitle>同一服务器，多个地址</SettingsTitle>}
              subtitle={
                <SettingsSubtitle
                  primary="添加局域网 IP 或外网域名，之后可在首页头像菜单中切换。"
                  lines={3}
                />
              }
            />
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>
    </>
  );
}
export default withOuterTheme(ServerLinesScreen);
