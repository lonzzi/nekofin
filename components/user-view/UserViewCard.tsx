import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaItem } from '@/services/media/types';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '../ui/IconSymbol';

export const UserViewCard = React.memo(function UserViewCard({
  item,
  title,
}: {
  item: MediaItem;
  title: string;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const useLiquidGlass = isLiquidGlassAvailable();

  const mediaAdapter = useMediaAdapter();

  const imageInfo = useMemo(() => mediaAdapter.getImageInfo({ item }), [mediaAdapter, item]);

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
      <GlassView
        style={[styles.cardGlass, !useLiquidGlass && { backgroundColor: theme.colors.surface }]}
        glassEffectStyle="regular"
        tintColor="rgba(255,255,255,0.10)"
      >
        <View pointerEvents="none" style={styles.cardRim} />
        {imageInfo.url ? (
          <Image
            source={{ uri: imageInfo.url }}
            placeholder={{
              blurhash: imageInfo.blurhash,
            }}
            style={[styles.cover, { backgroundColor: theme.colors.surfaceMuted }]}
            contentFit="cover"
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
        <View style={styles.userViewInfo}>
          <Text
            style={[theme.typography.footnote, styles.userViewTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </GlassView>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  userViewCard: {
    width: 200,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  cardGlass: {
    width: '100%',
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    zIndex: 2,
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
    aspectRatio: 16 / 9,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
