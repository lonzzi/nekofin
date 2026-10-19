import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
  NativeSettingsTextField,
} from '@/components/ui/NativeSettings';
import { SettingsActionTitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { normalizeDanmakuApiUrl } from '@/services/danmakuSources';
import { useNativeState, type TextInputRef } from '@expo/ui';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, Platform } from 'react-native';

export default function DanmakuSourceEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sourceSettings, setSourceSettings } = useDanmakuSources();
  const existing = sourceSettings.customSources.find((source) => source.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.baseUrl ?? '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const nameState = useNativeState(name);
  const addressState = useNativeState(address);
  const [error, setError] = useState<{ field: 'name' | 'address'; message: string } | null>(null);
  const nameRef = useRef<TextInputRef>(null);
  const addressRef = useRef<TextInputRef>(null);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!Keyboard.isVisible()) return false;
      nameRef.current?.blur();
      addressRef.current?.blur();
      Keyboard.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, []);
  const save = () => {
    if (!name.trim()) {
      setError({ field: 'name', message: '请输入 API 名称' });
      nameRef.current?.focus();
      return;
    }
    try {
      const baseUrl = normalizeDanmakuApiUrl(address);
      if (
        sourceSettings.customSources.some(
          (source) => source.id !== id && source.baseUrl === baseUrl,
        )
      ) {
        throw new Error('这个 API 地址已经添加过了');
      }
      const source = { id: existing?.id ?? randomUUID(), name: name.trim(), baseUrl, enabled };
      setSourceSettings((current) => ({
        ...current,
        customSources: existing
          ? current.customSources.map((entry) => (entry.id === id ? source : entry))
          : [...current.customSources, source],
      }));
      router.back();
    } catch (error) {
      setError({
        field: 'address',
        message: error instanceof Error ? error.message : '请检查 API 地址',
      });
      addressRef.current?.focus();
    }
  };
  return (
    <>
      <OuterTitle>{existing ? '编辑弹幕 API' : '添加弹幕 API'}</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          accessibilityLabel="保存弹幕 API"
          icon={Platform.OS === 'ios' ? undefined : getNativeToolbarIcon('save', 'checkmark')}
          disabled={!name.trim() || !address.trim()}
          onPress={save}
          variant="done"
        >
          保存
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="danmaku-api-editor">
        <NativeSettingsSection
          title="名称"
          footer={error?.field === 'name' ? error.message : undefined}
        >
          <NativeSettingsTextField
            label="API 名称"
            ref={nameRef}
            value={nameState}
            onChangeText={(text) => {
              setName(text);
              if (error?.field === 'name') setError(null);
            }}
            placeholder="例如：家里的弹幕 API"
            testID="danmaku-api-name"
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title="API 地址"
          footer={error?.field === 'address' ? error.message : '弹弹 Play 兼容接口，可包含 Token。'}
        >
          <NativeSettingsTextField
            label="API 地址"
            ref={addressRef}
            value={addressState}
            onChangeText={(text) => {
              setAddress(text);
              if (error?.field === 'address') setError(null);
            }}
            placeholder="https://example.com/api/v2"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="danmaku-api-url"
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>启用此 API</SettingsTitle>}
            value={enabled}
            onValueChange={setEnabled}
          />
        </NativeSettingsSection>
        {existing ? (
          <NativeSettingsSection>
            <NativeSettingsItem
              title={<SettingsActionTitle>删除 API</SettingsActionTitle>}
              onPress={() =>
                Alert.alert('删除 API', '确定删除“' + existing.name + '”？', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      setSourceSettings((current) => ({
                        ...current,
                        customSources: current.customSources.filter((source) => source.id !== id),
                      }));
                      router.back();
                    },
                  },
                ])
              }
            />
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>
    </>
  );
}
