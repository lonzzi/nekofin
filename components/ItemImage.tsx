import { useAppTheme } from '@/lib/design-system';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image, ImageProps, ImageStyle } from 'expo-image';
import { ReactNode, useState } from 'react';
import { StyleProp, View } from 'react-native';

export const ItemImage = ({
  uri,
  style,
  placeholderBlurhash,
  contentFit,
  cachePolicy,
  fallback,
}: {
  uri?: string;
  style: StyleProp<ImageStyle>;
  placeholderBlurhash?: string;
  contentFit?: ImageProps['contentFit'];
  cachePolicy?: ImageProps['cachePolicy'];
  fallback?: ReactNode;
}) => {
  const [failed, setFailed] = useState(false);
  const theme = useAppTheme();

  if (!uri || failed) {
    return (
      <>
        {fallback ?? (
          <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
            <FontAwesome name="film" size={36} color={theme.colors.textTertiary} />
          </View>
        )}
      </>
    );
  }

  return (
    <Image
      source={{ uri: uri }}
      style={style}
      placeholder={placeholderBlurhash ? { blurhash: placeholderBlurhash } : undefined}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      onError={() => setFailed(true)}
    />
  );
};
