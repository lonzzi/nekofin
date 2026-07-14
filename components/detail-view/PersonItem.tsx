import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { MediaPerson } from '@/services/media/types';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ItemImage } from '../ItemImage';
import { ThemedText } from '../ThemedText';
import { CoverFrame } from '../ui/CoverFrame';
import { ShadowedGlassCard } from '../ui/GlassCard';
import { IconSymbol } from '../ui/IconSymbol';

export const PersonItem = memo(function PersonItem({ item }: { item: MediaPerson }) {
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();

  const imageInfo = useMemo(
    () => mediaAdapter.getImageInfo({ item, opts: { width: 300 } }),
    [item, mediaAdapter],
  );

  return (
    <ShadowedGlassCard
      radius={14}
      containerStyle={{ width: theme.layout.mediaRail.personCardWidth }}
      surface="transparent"
    >
      <CoverFrame aspectRatio={2 / 3} radius={14}>
        <ItemImage
          uri={imageInfo.url}
          style={[styles.personPoster, { backgroundColor: theme.colors.surfaceMuted }]}
          placeholderBlurhash={imageInfo.blurhash}
          cachePolicy="memory-disk"
          contentFit="cover"
          fallback={
            <View
              style={[
                styles.personPoster,
                styles.personPlaceholder,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <IconSymbol
                name="person.crop.rectangle"
                size={36}
                color={theme.colors.textTertiary}
              />
            </View>
          }
        />
      </CoverFrame>
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
});

const styles = StyleSheet.create({
  personPoster: {
    width: '100%',
    height: '100%',
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
