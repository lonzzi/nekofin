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
import { useTranslation } from '@/lib/i18n';
import { normalizeDanmakuApiUrl } from '@/services/danmakuSources';
import { useNativeState, type TextInputRef } from '@expo/ui';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, Platform } from 'react-native';

export default function DanmakuSourceEditor() {
  const { t: tr } = useTranslation();
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
      setError({ field: 'name', message: tr('danmaku.enterApiName') });
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
        throw new Error(tr('danmaku.duplicateApiUrl'));
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
        message: error instanceof Error ? error.message : tr('danmaku.checkApiUrl'),
      });
      addressRef.current?.focus();
    }
  };
  return (
    <>
      <OuterTitle>{existing ? tr('danmaku.editApi') : tr('danmaku.addApi')}</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          accessibilityLabel={tr('danmaku.saveApi')}
          icon={Platform.OS === 'ios' ? undefined : getNativeToolbarIcon('save', 'checkmark')}
          disabled={!name.trim() || !address.trim()}
          onPress={save}
          variant="done"
        >
          {tr('common.save')}
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="danmaku-api-editor">
        <NativeSettingsSection
          title={tr('common.name')}
          footer={error?.field === 'name' ? error.message : undefined}
        >
          <NativeSettingsTextField
            label={tr('danmaku.apiName')}
            ref={nameRef}
            value={nameState}
            onChangeText={(text) => {
              setName(text);
              if (error?.field === 'name') setError(null);
            }}
            placeholder={tr('danmaku.apiNamePlaceholder')}
            testID="danmaku-api-name"
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title={tr('danmaku.apiUrl')}
          footer={
            error?.field === 'address' ? error.message : tr('danmaku.apiCompatibilityDescription')
          }
        >
          <NativeSettingsTextField
            label={tr('danmaku.apiUrl')}
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
            title={<SettingsTitle>{tr('danmaku.enableApi')}</SettingsTitle>}
            value={enabled}
            onValueChange={setEnabled}
          />
        </NativeSettingsSection>
        {existing ? (
          <NativeSettingsSection>
            <NativeSettingsItem
              title={<SettingsActionTitle>{tr('danmaku.deleteApi')}</SettingsActionTitle>}
              onPress={() =>
                Alert.alert(
                  tr('danmaku.deleteApi'),
                  tr('common.deleteNamedConfirmation', { name: existing.name }),
                  [
                    { text: tr('common.cancel'), style: 'cancel' },
                    {
                      text: tr('common.delete'),
                      style: 'destructive',
                      onPress: () => {
                        setSourceSettings((current) => ({
                          ...current,
                          customSources: current.customSources.filter((source) => source.id !== id),
                        }));
                        router.back();
                      },
                    },
                  ],
                )
              }
            />
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>
    </>
  );
}
