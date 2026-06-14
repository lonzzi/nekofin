import type { MediaServerType } from '@/services/media/types';
import { Image, type ImageSource } from 'expo-image';
import { StyleSheet } from 'react-native';

type ServerTypeIconProps = {
  type: MediaServerType;
  size?: number;
};

const iconSourceByType: Record<MediaServerType, ImageSource> = {
  jellyfin: require('../../assets/icons/jellyfin-icon--color-on-light.png'),
  emby: require('../../assets/icons/emby.svg'),
};

export function ServerTypeIcon({ type, size = 22 }: ServerTypeIconProps) {
  return (
    <Image
      source={iconSourceByType[type]}
      style={[styles.icon, { width: size, height: size }]}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});
