import { Image, type ImageProps } from 'expo-image';
import { useMemo, useRef, useState } from 'react';

type RetryableImageProps = Omit<ImageProps, 'source'> & { uri?: string };

/** Give a corrupt cache entry or transient response one fresh network attempt. */
export function RetryableImage(props: RetryableImageProps) {
  return <ImageRequest key={JSON.stringify([props.uri, props.recyclingKey])} {...props} />;
}

function ImageRequest({ uri, cachePolicy, onError, onDisplay, ...props }: RetryableImageProps) {
  const [attempt, setAttempt] = useState(0);
  const activeAttempt = useRef(0);
  const source = useMemo(
    () =>
      uri
        ? {
            uri,
            ...(attempt > 0 ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
          }
        : undefined,
    [uri, attempt],
  );

  return (
    <Image
      {...props}
      key={attempt}
      source={source}
      cachePolicy={attempt > 0 ? 'none' : cachePolicy}
      onError={(event) => {
        if (activeAttempt.current !== attempt) return;
        if (attempt === 0 && uri && /^https?:\/\//i.test(uri)) {
          activeAttempt.current = 1;
          setAttempt(1);
          return;
        }
        onError?.(event);
      }}
      onDisplay={() => {
        if (activeAttempt.current === attempt) onDisplay?.();
      }}
    />
  );
}
