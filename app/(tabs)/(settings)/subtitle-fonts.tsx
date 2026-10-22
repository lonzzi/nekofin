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
import { useTranslation } from '@/lib/i18n';
import { toast } from '@/lib/toast';
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
  const { t: tr } = useTranslation();
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
        toast.error(
          key === 'server' ? tr('fonts.loadServerFontsFailed') : tr('fonts.importFailed'),
          {
            description: error instanceof Error ? error.message : tr('fonts.tryAgainLater'),
          },
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
        if (!signal.aborted) toast.success(tr('fonts.imported'));
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
        throw new Error(tr('fonts.loadServerFontsFailedRetry'));
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
    });
  return (
    <>
      <OuterTitle>{tr('fonts.subtitleFonts')}</OuterTitle>
      <NativeSettingsForm testID="subtitle-font-settings">
        <NativeSettingsSection title={tr('fonts.playerFont')}>
          <NativeSettingsPicker
            disabled={busy}
            title={<SettingsTitle>{tr('fonts.selectedFont')}</SettingsTitle>}
            value={selection ? JSON.stringify(selection) : 'auto'}
            options={[
              { title: tr('fonts.useSubtitleOrServerFont'), value: 'auto' },
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
          title={tr('fonts.importFont')}
          footer={tr('fonts.supportedFormatsDescription')}
        >
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone="accent">
                {pending === 'file' ? tr('fonts.importingFile') : tr('fonts.importFromFile')}
              </SettingsActionTitle>
            }
            onPress={importFile}
            disabled={busy}
            busy={pending === 'file'}
          />
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone="accent">{tr('fonts.importFromUrl')}</SettingsActionTitle>
            }
            disclosure
            onPress={() => router.push('/subtitle-font-url')}
            disabled={busy}
          />
        </NativeSettingsSection>
        {currentServer?.type === 'jellyfin' && (
          <NativeSettingsSection
            title={tr('fonts.serverFonts')}
            footer={serverFonts?.length ? tr('fonts.autoSelectDescription') : undefined}
          >
            <NativeSettingsItem
              title={
                <SettingsActionTitle tone="accent">
                  {pending === 'server'
                    ? tr('fonts.loadingServerFonts')
                    : tr('fonts.viewServerFonts')}
                </SettingsActionTitle>
              }
              onPress={loadServerFonts}
              disabled={busy}
              busy={pending === 'server'}
            />
            {serverFonts?.length === 0 && (
              <NativeSettingsItem
                title={<SettingsTitle>{tr('fonts.noServerFonts')}</SettingsTitle>}
              />
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
                    label={tr('fonts.import')}
                    disabled={busy}
                    accessibilityLabel={tr('fonts.importNamedFont', { name: font.name })}
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
            title={tr('fonts.alreadyImported')}
            footer={tr('fonts.deleteSelectedDescription')}
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
                    label={tr('common.delete')}
                    disabled={busy}
                    destructive
                    accessibilityLabel={tr('fonts.deleteNamedFont', { name: font.name })}
                    onPress={() =>
                      Alert.alert(
                        tr('fonts.deleteConfirmationTitle'),
                        `“${font.name}”${selection?.id === font.id ? tr('fonts.deleteRestoreNote') : ''}`,
                        [
                          { text: tr('common.cancel'), style: 'cancel' },
                          {
                            text: tr('common.delete'),
                            style: 'destructive',
                            onPress: () => {
                              try {
                                removeCustomSubtitleFont(font.id);
                                toast.success(tr('fonts.deleted'));
                              } catch {
                                toast.error(tr('fonts.deleteFailed'), {
                                  description: tr('fonts.tryAgainLater'),
                                });
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
