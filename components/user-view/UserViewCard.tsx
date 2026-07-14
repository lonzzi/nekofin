import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import { Image } from 'expo-image';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverFrame } from '../ui/CoverFrame';
import { ShadowedGlassCard } from '../ui/GlassCard';
import { IconSymbol } from '../ui/IconSymbol';

export const UserViewCard = React.memo(function UserViewCard({
  item,
  title,
}: {
  item: MediaItem;
  title: string;
}) {
  const router = useTracedRouter('user-view-card');
  const theme = useAppTheme();

  const mediaAdapter = useMediaAdapter();

  const imageInfo = useMemo(
    () => mediaAdapter.getImageInfo({ item, opts: { width: 400 } }),
    [mediaAdapter, item],
  );

  const handlePress = useCallback(() => {
    if (!item) return;
    router.push({
      pathname: '/(tabs)/(servers)/folder/[id]',
      params: {
        id: item.id!,
        name: title,
        itemTypes: item.collectionType === 'movies' ? 'Movie' : 'Series',
      },
    });
  }, [item, title, router]);

  return (
    <Pressable style={styles.userViewCard} onPress={handlePress}>
      <ShadowedGlassCard radius={14}>
        <CoverFrame aspectRatio={16 / 9} radius={14}>
          {imageInfo.url ? (
            <Image
              source={{ uri: imageInfo.url }}
              placeholder={{
                blurhash: imageInfo.blurhash,
              }}
              style={[styles.cover, { backgroundColor: theme.colors.surfaceMuted }]}
              cachePolicy="disk"
              contentFit="cover"
              enforceEarlyResizing
            />
          ) : (
            <View
              style={[
                styles.cover,
                styles.coverPlaceholder,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <IconSymbol
                name="chevron.left.forwardslash.chevron.right"
                size={48}
                color={theme.colors.textTertiary}
              />
            </View>
          )}
        </CoverFrame>
        <View style={styles.userViewInfo}>
          <Text
            style={[theme.typography.footnote, styles.userViewTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
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
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
