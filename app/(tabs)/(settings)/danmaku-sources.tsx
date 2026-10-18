import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useRouter } from 'expo-router';

export default function DanmakuSourcesScreen() {
  const router = useRouter();
  const { sourceSettings, setSourceSettings } = useDanmakuSources();
  return (
    <>
      <OuterTitle>弹幕 API</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('add', 'plus')}
          accessibilityLabel="添加弹幕 API"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(settings)/danmaku-source/[id]',
              params: { id: 'new' },
            })
          }
        >
          添加
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="danmaku-api-sources">
        <NativeSettingsSection title="内置接口">
          <NativeSettingsSwitch
            title={<SettingsTitle>默认 API</SettingsTitle>}
            value={sourceSettings.defaultEnabled}
            onValueChange={(defaultEnabled) =>
              setSourceSettings((current) => ({ ...current, defaultEnabled }))
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="自定义接口">
          {sourceSettings.customSources.map((source) => (
            <NativeSettingsItem
              key={source.id}
              title={<SettingsTitle>{source.name}</SettingsTitle>}
              subtitle={
                <SettingsSubtitle
                  primary={
                    new URL(source.baseUrl).host + (source.enabled ? ' · 已启用' : ' · 已停用')
                  }
                />
              }
              disclosure
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(settings)/danmaku-source/[id]',
                  params: { id: source.id },
                })
              }
            />
          ))}
          {!sourceSettings.customSources.length ? (
            <NativeSettingsItem title={<SettingsTitle>还没有自定义 API</SettingsTitle>} />
          ) : null}
        </NativeSettingsSection>
        <NativeSettingsSection
          title="自动匹配"
          footer="最佳匹配使用一个匹配源；合并匹配源会合并多个来源的弹幕。播放时可随时切换。"
        >
          <NativeSettingsPicker
            title={<SettingsTitle>默认显示方式</SettingsTitle>}
            value={sourceSettings.mode}
            options={[
              { title: '最佳匹配', value: 'auto' },
              { title: '合并匹配源', value: 'merge' },
            ]}
            onValueChange={(value) =>
              setSourceSettings((current) => ({
                ...current,
                mode: value === 'merge' ? 'merge' : 'auto',
              }))
            }
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
