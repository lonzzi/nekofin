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
import { importCustomSubtitleFont, normalizeFontUrl } from '@/services/customSubtitleFonts';
import { useNativeState } from '@expo/ui';
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
        <NativeSettingsSection
          title="字体文件链接"
          footer="填写字体文件的直接链接。导入后自动设为当前字体。"
        >
          <NativeSettingsTextField
            label="字体文件链接"
            value={value}
            editable={!busy}
            onChangeText={setUrl}
            placeholder="https://example.com/font.ttf"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {busy ? (
            <NativeSettingsItem title={<SettingsTitle>正在下载并导入字体…</SettingsTitle>} busy />
          ) : null}
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
