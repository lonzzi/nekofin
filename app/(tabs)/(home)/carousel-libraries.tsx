import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { useHiddenUserViews } from '@/hooks/useHiddenUserViews';
import { useHomeCarouselLibraries } from '@/hooks/useHomeCarouselLibraries';
import { useMediaServerSources } from '@/hooks/useMediaServerSources';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import {
  setHomeCarouselLibraries,
  setHomeCarouselLibraryEnabled,
} from '@/lib/utils/homeCarouselConfig';
import { homeCarouselLibraryIds, visibleHomeLibraryIds } from '@/services/media/homeVisibility';
import { homeUserViewsQueryOptions } from '@/services/media/queryOptions';
import { useQueries } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

function CarouselLibrariesScreen() {
  const { t: tr } = useTranslation();
  const { serverId } = useLocalSearchParams<{ serverId?: string }>();
  const { servers: allServers, activeServers } = useMediaServers();
  const router = useRouter();
  const servers = useMemo(
    () => (serverId ? allServers.filter((server) => server.id === serverId) : activeServers),
    [serverId, allServers, activeServers],
  );
  const sources = useMediaServerSources(servers);
  const serverIds = servers.map((server) => server.id);
  const hidden = useHiddenUserViews(serverIds);
  const selected = useHomeCarouselLibraries(serverIds);
  const queries = useQueries({
    queries: sources.map(({ server, adapter }) => ({
      ...homeUserViewsQueryOptions({ adapter, currentServer: server }),
      retry: 1,
    })),
  });

  return (
    <>
      <OuterScreenOptions title={tr('home.featuredLibraries')} grouped />
      <NativeSettingsForm testID="home-carousel-libraries-form">
        {sources.length === 0 ? (
          <NativeSettingsSection>
            <NativeSettingsItem
              title={<SettingsTitle>{tr('server.noMediaAccounts')}</SettingsTitle>}
            />
          </NativeSettingsSection>
        ) : null}
        {sources.map(({ server }, index) => {
          const query = queries[index];
          const selection = selected[server.id];
          const visibleIds = visibleHomeLibraryIds(query.data, hidden[server.id]);
          const selectedIds = homeCarouselLibraryIds(query.data, hidden[server.id], selection);
          const visible = new Set(visibleIds);
          const libraries = (query.data ?? []).filter((library) => visible.has(library.id));

          return (
            <NativeSettingsSection
              key={server.id}
              title={`${server.name}${server.username ? ` · ${server.username}` : ''}`}
              footer={
                query.isSuccess && selection !== null && selectedIds.length === 0
                  ? tr('home.noCarouselLibrariesDescription')
                  : tr('home.carouselLibrariesDescription')
              }
            >
              {query.isPending ? (
                <NativeSettingsItem
                  title={<SettingsTitle>{tr('media.loadingLibraries')}</SettingsTitle>}
                  busy
                />
              ) : query.isError ? (
                <NativeSettingsItem
                  title={
                    <SettingsActionTitle tone="accent">
                      {tr('media.librariesLoadFailed')}
                    </SettingsActionTitle>
                  }
                  onPress={() => void query.refetch()}
                />
              ) : libraries.length === 0 ? (
                <NativeSettingsItem
                  title={<SettingsTitle>{tr('home.noVisibleLibraries')}</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary={tr('home.enableLibrariesHint')} />}
                  disclosure
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/(servers)/server-config/[serverId]',
                      params: { serverId: server.id },
                    })
                  }
                />
              ) : (
                <>
                  <NativeSettingsSwitch
                    title={<SettingsTitle>{tr('home.allVisibleLibraries')}</SettingsTitle>}
                    subtitle={<SettingsSubtitle primary={tr('home.includeFutureLibraries')} />}
                    value={selection === null}
                    onValueChange={(all) =>
                      setHomeCarouselLibraries(server.id, all ? null : visibleIds)
                    }
                  />
                  {libraries.map((library) => (
                    <NativeSettingsSwitch
                      key={library.id}
                      title={
                        <SettingsTitle>{library.name || tr('media.unknownLibrary')}</SettingsTitle>
                      }
                      value={selectedIds.includes(library.id)}
                      onValueChange={(enabled) =>
                        setHomeCarouselLibraryEnabled(server.id, library.id, enabled, visibleIds)
                      }
                    />
                  ))}
                </>
              )}
            </NativeSettingsSection>
          );
        })}
      </NativeSettingsForm>
    </>
  );
}

export default withOuterTheme(CarouselLibrariesScreen);
