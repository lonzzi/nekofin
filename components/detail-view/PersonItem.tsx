import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaPerson } from '@/services/media/types';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import { ShadowedGlassCard } from '../ui/GlassCard';
import { IconSymbol } from '../ui/IconSymbol';

export const PersonItem = ({ item }: { item: MediaPerson }) => {
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();

  const imageInfo = mediaAdapter.getImageInfo({ item, opts: { width: 300 } });
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <ShadowedGlassCard
      radius={14}
      containerStyle={{ width: theme.layout.mediaRail.personCardWidth }}
    >
      {imageFailed || !imageInfo.url ? (
        <View
          style={[
            styles.personPoster,
            styles.personPlaceholder,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <IconSymbol name="person.crop.rectangle" size={36} color={theme.colors.textTertiary} />
        </View>
      ) : (
        <Image
          source={{ uri: imageInfo.url }}
          style={[styles.personPoster, { backgroundColor: theme.colors.surfaceMuted }]}
          placeholder={imageInfo.blurhash ? { blurhash: imageInfo.blurhash } : undefined}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={styles.personCopy}>
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
    </ShadowedGlassCard>
  );
};

const styles = StyleSheet.create({
  personPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  personPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  personCopy: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 2,
  },
  personName: {
    fontWeight: '600',
  },
  personRole: {},
});
