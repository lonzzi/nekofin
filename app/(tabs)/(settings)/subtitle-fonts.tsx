import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsButton,
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { useCustomSubtitleFonts } from '@/hooks/useCustomSubtitleFonts';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import {
  importCustomSubtitleFont,
  removeCustomSubtitleFont,
  selectCustomSubtitleFont,
} from '@/services/customSubtitleFonts';
import {
  deriveSubtitleFonts,
  fetchFallbackFonts,
  type SubtitleFont,
} from '@/services/media/subtitleFonts';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function SubtitleFontSettings() {
  const router = useRouter();
  const { fonts, selection } = useCustomSubtitleFonts();
  const { currentApi, currentServer } = useMediaServers();
  const [pending, setPending] = useState<string | null>(null);
  const busy = pending !== null;
  const [serverFonts, setServerFonts] = useState<SubtitleFont[]>();
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    operation.current?.abort();
    operation.current = null;
    setPending(null);
    setServerFonts(undefined);
  }, [currentServer?.id]);

  const run = async (key: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setPending(key);
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted)
        Alert.alert(
          key === 'server' ? '无法读取服务器字体' : '无法导入字体',
          error instanceof Error ? error.message : '请稍后重试',
        );
    } finally {
      if (!controller.signal.aborted) setPending(null);
      if (operation.current === controller) operation.current = null;
    }
  };
  const importFile = () =>
    void run('file', async (signal) => {
      const result = await getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      try {
        await importCustomSubtitleFont({ uri: asset.uri, name: asset.name, signal });
      } finally {
        const temporary = new File(asset.uri);
        if (temporary.exists) temporary.delete();
      }
    });
  const loadServerFonts = () =>
    void run('server', async (signal) => {
      if (!currentApi || currentServer?.type !== 'jellyfin') return;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 8000);
      try {
        const fallback = await fetchFallbackFonts(currentApi, controller.signal);
        if (!signal.aborted)
          setServerFonts(
            deriveSubtitleFonts(
              currentApi,
              'jellyfin',
              '',
              { id: '', protocol: 'File', container: '', mediaStreams: [] },
              fallback,
            ),
          );
      } catch {
        throw new Error('无法读取服务器字体，请稍后重试');
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
    });
  return (
    <>
      <OuterTitle>字幕字体</OuterTitle>
      <NativeSettingsForm testID="subtitle-font-settings">
        <NativeSettingsSection title="播放器字体">
          <NativeSettingsPicker
            disabled={busy}
            title={<SettingsTitle>当前字体</SettingsTitle>}
            value={selection ? JSON.stringify(selection) : 'auto'}
            options={[
              { title: '跟随字幕与服务器', value: 'auto' },
              ...fonts.flatMap((font) =>
                font.families.map((family) => ({
                  title: family,
                  value: JSON.stringify({ id: font.id, family }),
                })),
              ),
            ]}
            onValueChange={(value) =>
              selectCustomSubtitleFont(value === 'auto' ? undefined : JSON.parse(value))
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title="导入字体"
          footer="支持 TTF、OTF、TTC、WOFF、WOFF2，单个文件不超过 32 MB。导入后自动设为当前字体。"
        >
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone="accent">
                {pending === 'file' ? '正在导入文件…' : '从文件导入'}
              </SettingsActionTitle>
            }
            onPress={importFile}
            disabled={busy}
            busy={pending === 'file'}
          />
          <NativeSettingsItem
            title={<SettingsActionTitle tone="accent">从 URL 导入</SettingsActionTitle>}
            disclosure
            onPress={() => router.push('/subtitle-font-url')}
            disabled={busy}
          />
        </NativeSettingsSection>
        {currentServer?.type === 'jellyfin' && (
          <NativeSettingsSection
            title="服务端字体"
            footer={serverFonts?.length ? '导入后自动设为当前字体。' : undefined}
          >
            <NativeSettingsItem
              title={
                <SettingsActionTitle tone="accent">
                  {pending === 'server' ? '正在读取服务器字体…' : '查看服务器字体'}
                </SettingsActionTitle>
              }
              onPress={loadServerFonts}
              disabled={busy}
              busy={pending === 'server'}
            />
            {serverFonts?.length === 0 && (
              <NativeSettingsItem title={<SettingsTitle>服务器暂无可导入的字体</SettingsTitle>} />
            )}
            {serverFonts?.map((font) => (
              <NativeSettingsItem
                key={font.revision}
                title={<SettingsTitle>{font.name}</SettingsTitle>}
                subtitle={<SettingsSubtitle primary={sizeLabel(font.size ?? 0)} />}
                disabled={busy}
                busy={pending === font.revision}
                trailing={
                  <NativeSettingsButton
                    label="导入"
                    disabled={busy}
                    accessibilityLabel={`导入字体 ${font.name}`}
                    onPress={() =>
                      void run(font.revision, async (signal) => {
                        await importCustomSubtitleFont({
                          uri: font.url,
                          name: font.name,
                          signal,
                          headers: currentApi?.accessToken
                            ? { 'X-Emby-Token': currentApi.accessToken }
                            : undefined,
                        });
                      })
                    }
                  />
                }
              />
            ))}
          </NativeSettingsSection>
        )}
        {fonts.length > 0 && (
          <NativeSettingsSection
            title="已导入"
            footer="删除当前使用的字体后，将恢复“跟随字幕与服务器”。"
          >
            {fonts.map((font) => (
              <NativeSettingsItem
                key={font.id}
                title={<SettingsTitle>{font.name}</SettingsTitle>}
                subtitle={
                  <SettingsSubtitle
                    primary={`${font.families.join('、')} · ${sizeLabel(font.size)}`}
                  />
                }
                disabled={busy}
                trailing={
                  <NativeSettingsButton
                    label="删除"
                    disabled={busy}
                    destructive
                    accessibilityLabel={`删除字体 ${font.name}`}
                    onPress={() =>
                      Alert.alert(
                        '删除字体？',
                        `“${font.name}”${selection?.id === font.id ? '\n删除后将恢复“跟随字幕与服务器”。' : ''}`,
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '删除',
                            style: 'destructive',
                            onPress: () => {
                              try {
                                removeCustomSubtitleFont(font.id);
                              } catch {
                                Alert.alert('无法删除字体', '请稍后重试');
                              }
                            },
                          },
                        ],
                      )
                    }
                  />
                }
              />
            ))}
          </NativeSettingsSection>
        )}
      </NativeSettingsForm>
    </>
  );
}
