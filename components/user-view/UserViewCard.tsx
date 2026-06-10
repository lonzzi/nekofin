import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaItem } from '@/services/media/types';
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
      {imageInfo.url ? (
        <Image
          source={{ uri: imageInfo.url }}
          placeholder={{
            blurhash: imageInfo.blurhash,
          }}
          style={[
            styles.cover,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
          ]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.cover,
            styles.coverPlaceholder,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
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
    </Pressable>
  );
});

const styles = StyleSheet.create({
  userViewCard: {
    overflow: 'hidden',
  },
  userViewInfo: {
    padding: 8,
  },
  userViewTitle: {
    marginBottom: 2,
    textAlign: 'center',
  },
  cover: {
    width: 200,
    aspectRatio: 16 / 9,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
