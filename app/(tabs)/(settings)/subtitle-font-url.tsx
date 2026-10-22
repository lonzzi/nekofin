import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsTextField,
} from '@/components/ui/NativeSettings';
import { SettingsTitle } from '@/components/ui/SettingsVisual';
import { useTranslation } from '@/lib/i18n';
import { importCustomSubtitleFont, normalizeFontUrl } from '@/services/customSubtitleFonts';
import { useNativeState } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform } from 'react-native';

export default function SubtitleFontUrl() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const value = useNativeState(url);
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const save = async () => {
    if (operation.current) return;
    const controller = new AbortController();
    try {
      const uri = normalizeFontUrl(url);
      operation.current = controller;
      setBusy(true);
      Keyboard.dismiss();
      let name: string | undefined;
      try {
        name = decodeURIComponent(new URL(uri).pathname.split('/').at(-1) ?? '');
      } catch {}
      await importCustomSubtitleFont({ uri, name, signal: controller.signal });
      if (!controller.signal.aborted) router.back();
    } catch (error) {
      if (!controller.signal.aborted)
        Alert.alert(
          tr('fonts.importFailed'),
          error instanceof Error ? error.message : tr('fonts.checkUrl'),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (operation.current === controller) operation.current = null;
    }
  };
  return (
    <>
      <OuterTitle>{tr('fonts.importFromUrl')}</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          accessibilityLabel={tr('fonts.importFont')}
          icon={Platform.OS === 'ios' ? undefined : getNativeToolbarIcon('save', 'checkmark')}
          disabled={busy || !url.trim()}
          onPress={() => void save()}
          variant="done"
        >
          {busy ? tr('fonts.importing') : tr('fonts.import')}
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="subtitle-font-url">
        <NativeSettingsSection
          title={tr('fonts.fileUrl')}
          footer={tr('fonts.importUrlDescription')}
        >
          <NativeSettingsTextField
            label={tr('fonts.fileUrl')}
            value={value}
            editable={!busy}
            onChangeText={setUrl}
            placeholder="https://example.com/font.ttf"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {busy ? (
            <NativeSettingsItem
              title={<SettingsTitle>{tr('fonts.downloadingAndImporting')}</SettingsTitle>}
              busy
            />
          ) : null}
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
