import { AddServerForm, type AddServerFormHandle } from '@/components/AddServerForm';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

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
  const navigation = useNavigation();
  const router = useRouter();
  const theme = useAppTheme();
  const [isSaving, setIsSaving] = useState(false);

  const title = useMemo(() => serverTitleByType[serverType], [serverType]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: title,
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存服务器"
          disabled={isSaving}
          hitSlop={10}
          onPress={() => {
            void formRef.current?.submit();
          }}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
        >
          <Text
            style={[
              styles.saveText,
              { color: isSaving ? theme.colors.textTertiary : theme.colors.text },
            ]}
          >
            {isSaving ? '保存中...' : '保存'}
          </Text>
        </Pressable>
      ),
    });
  }, [isSaving, navigation, theme.colors.text, theme.colors.textTertiary, title]);

  return (
    <AddServerForm
      ref={formRef}
      serverType={serverType}
      onLoadingChange={setIsSaving}
      onSuccess={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  saveButton: {
    minHeight: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.68,
  },
});
