import { AddServerForm, type AddServerFormHandle } from '@/components/AddServerForm';
import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getAddServerSavePresentation } from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import type { MediaServerType } from '@/services/media/types';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

const serverTitleByType: Record<MediaServerType, string> = {
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

function getServerType(value: string | string[] | undefined): MediaServerType {
  return value === 'emby' ? 'emby' : 'jellyfin';
}

export default function AddServerScreen() {
  const { serverType: serverTypeParam, serverId } = useLocalSearchParams<{
    serverType?: string;
    serverId?: string;
  }>();
  const { servers } = useMediaServers();
  const existingServer = servers.find((server) => server.id === serverId);
  const serverType = existingServer?.type ?? getServerType(serverTypeParam);
  const formRef = useRef<AddServerFormHandle>(null);
  const router = useTracedRouter('add-server');
  const [isSaving, setIsSaving] = useState(false);

  const title = useMemo(() => serverTitleByType[serverType], [serverType]);
  const savePresentation = getAddServerSavePresentation(isSaving);

  return (
    <>
      <Stack.Title large={!(Platform.OS === 'ios' && Platform.isPad)}>{title}</Stack.Title>
      <HeaderToolbar placement="right">
        <HeaderButton
          accessibilityLabel={savePresentation.accessibilityLabel}
          disabled={savePresentation.disabled}
          icon={
            process.env.EXPO_OS === 'ios' ? undefined : getNativeToolbarIcon('save', 'checkmark')
          }
          onPress={() => {
            void formRef.current?.submit();
          }}
          variant="done"
        >
          {savePresentation.label}
        </HeaderButton>
      </HeaderToolbar>
      <AddServerForm
        existingServer={existingServer}
        ref={formRef}
        serverType={serverType}
        onLoadingChange={setIsSaving}
        onSuccess={() => router.back()}
      />
    </>
  );
}
