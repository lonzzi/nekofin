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
      <OuterScreenOptions title="轮播图媒体库" grouped />
      <NativeSettingsForm testID="home-carousel-libraries-form">
        {sources.length === 0 ? (
          <NativeSettingsSection>
            <NativeSettingsItem title={<SettingsTitle>暂无可用媒体账号</SettingsTitle>} />
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
                  ? '未选择可用媒体库，此账号不参与轮播图展示。修改后自动保存。'
                  : '修改后自动保存，适用于该账号首页与聚合首页。已隐藏的媒体库不会参与轮播。'
              }
            >
              {query.isPending ? (
                <NativeSettingsItem title={<SettingsTitle>正在加载媒体库…</SettingsTitle>} busy />
              ) : query.isError ? (
                <NativeSettingsItem
                  title={
                    <SettingsActionTitle tone="accent">
                      媒体库加载失败，点按重试
                    </SettingsActionTitle>
                  }
                  onPress={() => void query.refetch()}
                />
              ) : libraries.length === 0 ? (
                <NativeSettingsItem
                  title={<SettingsTitle>暂无可见媒体库</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary="可在服务器设置中开启媒体库显示。" />}
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
                    title={<SettingsTitle>全部可见媒体库</SettingsTitle>}
                    subtitle={<SettingsSubtitle primary="自动包含以后新增的媒体库" />}
                    value={selection === null}
                    onValueChange={(all) =>
                      setHomeCarouselLibraries(server.id, all ? null : visibleIds)
                    }
                  />
                  {libraries.map((library) => (
                    <NativeSettingsSwitch
                      key={library.id}
                      title={<SettingsTitle>{library.name || '未知媒体库'}</SettingsTitle>}
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
