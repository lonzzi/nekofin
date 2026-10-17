import { AddServerForm } from '@/components/AddServerForm';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { isMediaServerType } from '@/lib/mediaServerTypes';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams } from 'expo-router';

function AddServerScreen() {
  const { serverType: serverTypeParam, serverId } = useLocalSearchParams<{
    serverType?: string;
    serverId?: string;
  }>();
  const { servers } = useMediaServers();
  const existingServer = servers.find((server) => server.id === serverId);
  const serverType =
    existingServer?.type ?? (isMediaServerType(serverTypeParam) ? serverTypeParam : 'jellyfin');
  const router = useTracedRouter('add-server');
  return (
    <>
      <OuterScreenOptions
        title={existingServer ? '重新登录' : '添加服务器'}
        large={false}
        grouped
      />
      <AddServerForm
        key={existingServer?.id ?? serverType}
        existingServer={existingServer}
        serverType={serverType}
        onSuccess={() => router.back()}
      />
    </>
  );
}
export default withOuterTheme(AddServerScreen);
