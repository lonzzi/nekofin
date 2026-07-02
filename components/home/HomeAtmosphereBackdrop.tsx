import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Easing, StyleSheet, View } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';

function getGradientColors(colors: string[]) {
  return colors as unknown as readonly [string, string, ...string[]];
}

function getGradientLocations(locations: number[]) {
  return locations as unknown as readonly [number, number, ...number[]];
}

type HomeAtmosphereBackdropProps = {
  backgroundColor: string;
  blurhash?: string;
  imageUrl?: string;
  isDark: boolean;
};

export function HomeAtmosphereBackdrop({
  backgroundColor,
  blurhash,
  imageUrl,
  isDark,
}: HomeAtmosphereBackdropProps) {
  const imageOpacity = isDark ? 0.42 : 0.58;

  const atmosphereGradient = useMemo(
    () =>
      easeGradient({
        colorStops: isDark
          ? {
              0: { color: 'rgba(0,0,0,0.04)' },
              0.36: { color: 'rgba(0,0,0,0.12)' },
              0.72: { color: 'rgba(0,0,0,0.24)' },
              1: { color: 'rgba(0,0,0,0.36)' },
            }
          : {
              0: { color: 'rgba(255,255,255,0.03)' },
              0.34: { color: 'rgba(255,255,255,0.08)' },
              0.72: { color: 'rgba(255,255,255,0.2)' },
              1: { color: 'rgba(255,255,255,0.32)' },
            },
        easing: Easing.bezier(0.16, 0.0, 0.18, 1),
        extraColorStopsPerTransition: 36,
      }),
    [isDark],
  );

  return (
    <View style={[styles.backdrop, { backgroundColor }]}>
      {!!imageUrl && (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.baseImage, { opacity: imageOpacity }]}
            placeholder={blurhash ? { blurhash } : undefined}
            cachePolicy="memory-disk"
            contentFit="cover"
            contentPosition="center"
            blurRadius={88}
            transition={260}
          />
        </>
      )}
      <LinearGradient
        colors={getGradientColors(atmosphereGradient.colors)}
        locations={getGradientLocations(atmosphereGradient.locations)}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  baseImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
