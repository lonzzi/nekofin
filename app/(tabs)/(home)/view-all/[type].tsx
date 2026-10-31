import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useAggregateViewAll } from '@/hooks/useAggregateViewAll';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function AggregateViewAllScreen() {
  const { t: tr } = useTranslation();
  const { type, sectionKey, serverId } = useLocalSearchParams<{
    type: string;
    sectionKey?: string;
    serverId?: string;
  }>();
  const { activeServers: allServers } = useMediaServers();
  const servers = useMemo(
    () => (serverId ? allServers.filter((server) => server.id === serverId) : allServers),
    [allServers, serverId],
  );
  const view = useAggregateViewAll({ servers, type, sectionKey });
  return (
    <ItemGridScreen
      title={
        type === 'resume'
          ? tr('home.continueWatching')
          : type === 'nextup'
            ? tr('home.upNext')
            : (view.title ?? tr('home.recentlyAdded'))
      }
      data={view.items}
      getItemSource={view.getItemSource}
      showServerSource={servers.length > 1}
      dataState={view}
      type={type === 'latest' ? 'series' : 'episode'}
      disableGrouping
    />
  );
}
