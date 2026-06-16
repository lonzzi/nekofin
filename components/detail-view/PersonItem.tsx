import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaPerson } from '@/services/media/types';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import { IconSymbol } from '../ui/IconSymbol';

export const PersonItem = ({ item }: { item: MediaPerson }) => {
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();

  const imageInfo = mediaAdapter.getImageInfo({ item, opts: { width: 300 } });
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <View style={[styles.personCard, { width: theme.layout.mediaRail.personCardWidth }]}>
      {imageFailed || !imageInfo.url ? (
        <View
          style={[
            styles.personPoster,
            {
              width: theme.layout.mediaRail.personCardWidth,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <IconSymbol name="person.crop.rectangle" size={36} color={theme.colors.textTertiary} />
        </View>
      ) : (
        <Image
          source={{ uri: imageInfo.url }}
          style={[
            styles.personPoster,
            {
              width: theme.layout.mediaRail.personCardWidth,
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
            },
          ]}
          placeholder={imageInfo.blurhash ? { blurhash: imageInfo.blurhash } : undefined}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <ThemedText style={[theme.typography.footnote, styles.personName]} numberOfLines={1}>
        {item.name}
      </ThemedText>
      {!!item.role && (
        <ThemedText
          style={[
            theme.typography.caption,
            styles.personRole,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {item.role}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  personCard: {
    overflow: 'hidden',
  },
  personPoster: {
    aspectRatio: 2 / 3,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  personName: {
    fontWeight: '600',
    marginTop: 8,
  },
  personRole: {
    marginTop: 2,
  },
});
