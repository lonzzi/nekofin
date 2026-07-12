import { AddServerForm, type AddServerFormHandle } from '@/components/AddServerForm';
import { getAddServerSavePresentation } from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import type { MediaServerType } from '@/services/media/types';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';

const serverTitleByType: Record<MediaServerType, string> = {
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

function getServerType(value: string | string[] | undefined): MediaServerType {
  return value === 'emby' ? 'emby' : 'jellyfin';
}

export default function AddServerScreen() {
  const { serverType: serverTypeParam } = useLocalSearchParams<{ serverType?: string }>();
  const serverType = getServerType(serverTypeParam);
  const formRef = useRef<AddServerFormHandle>(null);
  const router = useTracedRouter('add-server');
  const [isSaving, setIsSaving] = useState(false);

  const title = useMemo(() => serverTitleByType[serverType], [serverType]);
  const savePresentation = getAddServerSavePresentation(isSaving);

  return (
    <>
      <Stack.Title>{title}</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
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
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <AddServerForm
        ref={formRef}
        serverType={serverType}
        onLoadingChange={setIsSaving}
        onSuccess={() => router.back()}
      />
    </>
  );
}
