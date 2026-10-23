import { AddServerForm } from '@/components/AddServerForm';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { isMediaServerType } from '@/lib/mediaServerTypes';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams } from 'expo-router';

function AddServerScreen() {
  const { t: tr } = useTranslation();
  const {
    serverType: serverTypeParam,
    serverId,
    accountServerId,
  } = useLocalSearchParams<{
    serverType?: string;
    serverId?: string;
    accountServerId?: string;
  }>();
  const { servers } = useMediaServers();
  const existingServer = servers.find((server) => server.id === serverId);
  const accountServer = servers.find((server) => server.id === accountServerId);
  const serverType =
    existingServer?.type ??
    accountServer?.type ??
    (isMediaServerType(serverTypeParam) ? serverTypeParam : 'jellyfin');
  const router = useTracedRouter('add-server');
  return (
    <>
      <OuterScreenOptions
        title={
          existingServer
            ? tr('server.signInAgain')
            : accountServer
              ? tr('server.addAccount')
              : tr('server.addServer')
        }
        large={false}
        grouped
      />
      <AddServerForm
        key={existingServer?.id ?? accountServer?.id ?? serverType}
        existingServer={existingServer}
        accountServer={accountServer}
        serverType={serverType}
        onSuccess={() => router.back()}
      />
    </>
  );
}
export default withOuterTheme(AddServerScreen);
