import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaPerson } from '@/services/media/types';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';
import { IconSymbol } from '../ui/IconSymbol';

export const PersonItem = ({ item }: { item: MediaPerson }) => {
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();
  const useLiquidGlass = isLiquidGlassAvailable();

  const imageInfo = mediaAdapter.getImageInfo({ item, opts: { width: 300 } });
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <View style={[styles.personCardShadow, { width: theme.layout.mediaRail.personCardWidth }]}>
      <GlassView
        style={[styles.personCard, !useLiquidGlass && { backgroundColor: theme.colors.surface }]}
        glassEffectStyle="regular"
        tintColor="rgba(255,255,255,0.10)"
      >
        <View pointerEvents="none" style={styles.personCardRim} />
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
      </GlassView>
    </View>
  );
};

const styles = StyleSheet.create({
  personCardShadow: {
    borderRadius: 14,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  personCard: {
    width: '100%',
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  personCardRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
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
