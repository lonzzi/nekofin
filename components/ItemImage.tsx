import { useAppTheme } from '@/lib/theme';
import { Image, ImageProps, ImageStyle } from 'expo-image';
import { ReactNode, useMemo, useState } from 'react';
import { StyleProp, StyleSheet, View } from 'react-native';

import { IconSymbol } from './ui/IconSymbol';

type ItemImageProps = {
  uri?: string;
  style: StyleProp<ImageStyle>;
  placeholderBlurhash?: string;
  contentFit?: ImageProps['contentFit'];
  contentPosition?: ImageProps['contentPosition'];
  cachePolicy?: ImageProps['cachePolicy'];
  enforceEarlyResizing?: ImageProps['enforceEarlyResizing'];
  fallback?: ReactNode;
  onError?: ImageProps['onError'];
  onLoad?: ImageProps['onLoad'];
  priority?: ImageProps['priority'];
  recyclingKey?: ImageProps['recyclingKey'];
  transition?: ImageProps['transition'];
};

export function ItemImage(props: ItemImageProps) {
  return <ItemImageContent key={JSON.stringify([props.uri, props.recyclingKey])} {...props} />;
}

function ItemImageContent({
  uri,
  style,
  placeholderBlurhash,
  contentFit,
  contentPosition,
  cachePolicy,
  enforceEarlyResizing = true,
  fallback,
  onError,
  onLoad,
  priority,
  recyclingKey,
  transition,
}: ItemImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const theme = useAppTheme();
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);
  const placeholder = useMemo(
    () => (placeholderBlurhash ? { blurhash: placeholderBlurhash } : undefined),
    [placeholderBlurhash],
  );

  return (
    <View style={[styles.frame, style]}>
      {!uri || status !== 'loaded' ? (
        <View style={StyleSheet.absoluteFill}>
          {fallback ?? (
            <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceMuted }]}>
              <IconSymbol name="video.fill" size={36} color={theme.colors.textTertiary} />
            </View>
          )}
        </View>
      ) : null}
      {uri && status !== 'error' ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          placeholder={placeholder}
          cachePolicy={cachePolicy}
          contentFit={contentFit}
          contentPosition={contentPosition}
          enforceEarlyResizing={enforceEarlyResizing}
          priority={priority}
          recyclingKey={recyclingKey ?? uri}
          transition={transition}
          onError={(event) => {
            setStatus('error');
            onError?.(event);
          }}
          onLoad={onLoad}
          onDisplay={() => setStatus('loaded')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
