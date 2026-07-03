import { useAppTheme } from '@/lib/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image, ImageProps, ImageStyle } from 'expo-image';
import { ReactNode, useMemo, useState } from 'react';
import { StyleProp, View } from 'react-native';

export const ItemImage = ({
  uri,
  style,
  placeholderBlurhash,
  contentFit,
  contentPosition,
  cachePolicy,
  enforceEarlyResizing = true,
  fallback,
  priority,
  recyclingKey,
  transition,
}: {
  uri?: string;
  style: StyleProp<ImageStyle>;
  placeholderBlurhash?: string;
  contentFit?: ImageProps['contentFit'];
  contentPosition?: ImageProps['contentPosition'];
  cachePolicy?: ImageProps['cachePolicy'];
  enforceEarlyResizing?: ImageProps['enforceEarlyResizing'];
  fallback?: ReactNode;
  priority?: ImageProps['priority'];
  recyclingKey?: ImageProps['recyclingKey'];
  transition?: ImageProps['transition'];
}) => {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const theme = useAppTheme();
  const didFail = !!uri && failedUri === uri;
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);
  const placeholder = useMemo(
    () => (placeholderBlurhash ? { blurhash: placeholderBlurhash } : undefined),
    [placeholderBlurhash],
  );

  if (!uri || didFail) {
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
      source={source}
      style={style}
      placeholder={placeholder}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      contentPosition={contentPosition}
      enforceEarlyResizing={enforceEarlyResizing}
      priority={priority}
      recyclingKey={recyclingKey ?? uri}
      transition={transition}
      onError={() => setFailedUri(uri)}
    />
  );
};
