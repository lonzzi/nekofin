import PageScrollView from '@/components/PageScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { SwitchSetting } from '@/components/ui/SwitchSetting';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getHiddenUserViews, toggleUserViewHidden } from '@/lib/utils/userViewConfig';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { serverUserViewsQueryOptions } from '@/services/media/queryOptions';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function ServerConfigScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { servers } = useMediaServers();

  const navigation = useNavigation();

  const server = useMemo(() => servers.find((s) => s.id === serverId), [servers, serverId]);
  const serverAdapter = useMemo(() => {
    if (!server) return null;
    const api = createMediaApiFromServerInfo(server);
    return createMediaAdapterWithApi(server.type, api);
  }, [server]);

  const userViewQuery = useQueryWithFocus({
    ...serverUserViewsQueryOptions({ adapter: serverAdapter, server }),
    refetchOnScreenFocus: 'stale',
  });

  const [hiddenUserViewIds, setHiddenUserViewIds] = useState<string[]>(() =>
    serverId ? getHiddenUserViews(serverId) : [],
  );

  useFocusEffect(
    useCallback(() => {
      if (serverId) {
        setHiddenUserViewIds(getHiddenUserViews(serverId));
      }
    }, [serverId]),
  );

  const handleToggleHidden = (userViewId: string, hidden: boolean) => {
    if (serverId) {
      toggleUserViewHidden(serverId, userViewId, hidden);
      setHiddenUserViewIds(getHiddenUserViews(serverId));
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: server?.name,
    });
  }, [navigation, server]);

  if (!server) {
    return (
      <PageScrollView style={styles.container}>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>服务器不存在</ThemedText>
        </View>
      </PageScrollView>
    );
  }

  return (
    <PageScrollView style={styles.container}>
      <Section title="媒体库设置">
        {userViewQuery.isPending ? (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.skeletonRow}>
                <View style={styles.skeletonLeft}>
                  <View style={styles.skeletonTextContainer}>
                    <Skeleton width={120} height={16} borderRadius={4} />
                  </View>
                </View>
                <Skeleton width={51} height={31} borderRadius={16} />
              </View>
            ))}
          </>
        ) : userViewQuery.data && userViewQuery.data.length > 0 ? (
          userViewQuery.data.map((userView) => {
            const isHidden = hiddenUserViewIds.includes(userView.id);
            return (
              <SwitchSetting
                key={userView.id}
                title={userView.name || '未知媒体库'}
                value={!isHidden}
                onValueChange={(visible) => handleToggleHidden(userView.id, !visible)}
              />
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>暂无媒体库</ThemedText>
          </View>
        )}
      </Section>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  skeletonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  skeletonTextContainer: {
    flex: 1,
    gap: 4,
  },
  skeletonSubtitle: {
    marginTop: 2,
  },
});
