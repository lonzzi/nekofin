import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

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
  const washColor = isDark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.14)';
  const lowerWashColor = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.26)';

  return (
    <View style={[styles.backdrop, { backgroundColor }]}>
      {!!imageUrl && (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.baseImage, { opacity: imageOpacity }]}
            placeholder={blurhash ? { blurhash } : undefined}
            cachePolicy="disk"
            contentFit="cover"
            contentPosition="center"
            enforceEarlyResizing
            blurRadius={36}
          />
        </>
      )}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: washColor }]}
      />
      <View pointerEvents="none" style={[styles.lowerWash, { backgroundColor: lowerWashColor }]} />
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
  lowerWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
  },
});
