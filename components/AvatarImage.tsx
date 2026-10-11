import { useAppTheme } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ImageStyle, StyleProp, View } from 'react-native';

interface AvatarImageProps {
  avatarUri?: string;
  style?: StyleProp<ImageStyle>;
}

export function AvatarImage({ avatarUri, style }: AvatarImageProps) {
  const [failedUri, setFailedUri] = useState<string>();
  const theme = useAppTheme();

  if (!avatarUri || failedUri === avatarUri) {
    return (
      <View
        style={[
          style,
          { backgroundColor: theme.colors.tint, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Ionicons name="person" size={20} color="white" />
      </View>
    );
  }

  return (
    <Image
      key={avatarUri}
      source={{ uri: avatarUri }}
      style={style}
      contentFit="cover"
      onError={() => setFailedUri(avatarUri)}
    />
  );
}
