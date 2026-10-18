import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { importCustomSubtitleFont, normalizeFontUrl } from '@/services/customSubtitleFonts';
import { TextInput, useNativeState } from '@expo/ui';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform } from 'react-native';

export default function SubtitleFontUrl() {
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
        Alert.alert('无法导入字体', error instanceof Error ? error.message : '请检查字体链接');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (operation.current === controller) operation.current = null;
    }
  };
  return (
    <>
      <OuterTitle>从 URL 导入</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          accessibilityLabel="导入字体"
          icon={Platform.OS === 'ios' ? undefined : getNativeToolbarIcon('save', 'checkmark')}
          disabled={busy || !url.trim()}
          onPress={() => void save()}
          variant="done"
        >
          {busy ? '正在导入…' : '导入'}
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="subtitle-font-url">
        <NativeSettingsSection title="字体文件链接">
          <NativeSettingsItem
            title={
              <TextInput
                value={value}
                onChangeText={setUrl}
                placeholder="https://example.com/font.ttf"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                modifiers={
                  Platform.OS === 'ios' ? [frame({ maxWidth: Infinity })] : [fillMaxWidth()]
                }
                style={{ height: 44 }}
              />
            }
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
