import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemImage } from '../ItemImage';
import type { MediaItemSource } from '../media/mediaSource';
import { ServerSourceLabel } from '../media/ServerSourceLabel';
import { CoverFrame } from '../ui/CoverFrame';
import { ShadowedGlassCard } from '../ui/GlassCard';

export const UserViewCard = React.memo(function UserViewCard({
  item,
  title,
  source,
  showServerSource = true,
}: {
  item: MediaItem;
  title: string;
  source?: MediaItemSource;
  showServerSource?: boolean;
}) {
  const { t: tr } = useTranslation();
  const router = useTracedRouter('user-view-card');
  const theme = useAppTheme();

  const currentAdapter = useMediaAdapter();
  const mediaAdapter = source?.adapter ?? currentAdapter;
  const { currentServer, setCurrentServer } = useMediaServers();

  const imageInfo = useMemo(
    () => mediaAdapter.getImageInfo({ item, opts: { width: 400 } }),
    [mediaAdapter, item],
  );

  const handlePress = useCallback(() => {
    if (!item) return;
    if (source && currentServer?.id !== source.server.id) setCurrentServer(source.server);
    router.push({
      pathname: source ? '/(tabs)/(home)/folder/[id]' : '/(tabs)/(servers)/folder/[id]',
      params: {
        id: item.id!,
        name: title,
        itemTypes: item.collectionType === 'movies' ? 'Movie' : 'Series',
      },
    });
  }, [item, title, router, source, currentServer?.id, setCurrentServer]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr('media.openLibrary', {
        value: source ? `${source.server.name} ` : '',
        title: title,
      })}
      style={styles.userViewCard}
      onPress={handlePress}
    >
      <ShadowedGlassCard radius={14} surface="transparent">
        <CoverFrame aspectRatio={16 / 9} radius={14}>
          <ItemImage
            uri={imageInfo.url}
            placeholderBlurhash={imageInfo.blurhash}
            style={[styles.cover, { backgroundColor: theme.colors.surfaceMuted }]}
            cachePolicy={Platform.OS === 'android' ? 'memory-disk' : 'disk'}
            contentFit="cover"
          />
        </CoverFrame>
        <View style={styles.userViewInfo}>
          <Text
            style={[theme.typography.footnote, styles.userViewTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {showServerSource && source ? (
            <View style={{ alignItems: 'center' }}>
              <ServerSourceLabel name={source.server.name} />
            </View>
          ) : null}
        </View>
      </ShadowedGlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  userViewCard: {
    width: 200,
  },
  userViewInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  userViewTitle: {
    marginBottom: 2,
    textAlign: 'center',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
});
