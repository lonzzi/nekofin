import { Image } from 'expo-image';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const nativeAvatar = requireOptionalNativeModule<{
  createCircularImage(image: Awaited<ReturnType<typeof Image.loadAsync>>): Promise<string>;
}>('ToolbarAvatar');

const avatars = new Map<string, Promise<string>>();
const readyAvatars = new Map<string, string>();

export function getCachedToolbarAvatar(uri: string): string | undefined {
  return readyAvatars.get(uri);
}

/** UIKit renders the circular image; UIBarButtonItem renders the menu button. */
export function getToolbarAvatar(uri: string): Promise<string> {
  if (Platform.OS === 'android') {
    const cached = avatars.get(uri);
    if (cached) return cached;
    // Compose's Icon has no error slot. Keep the bundled icon until a decoded
    // local image is ready, rather than replacing it with an unverified URL.
    const image = Image.prefetch(uri, { cachePolicy: 'disk' })
      .then(async (success) => {
        if (!success) throw new Error('Toolbar avatar could not be loaded');
        const path = await Image.getCachePathAsync(uri);
        if (!path) throw new Error('Toolbar avatar is not cached');
        const localUri = path.startsWith('file://') ? path : `file://${path}`;
        await Image.loadAsync(localUri, { maxWidth: 108, maxHeight: 108 });
        readyAvatars.set(uri, localUri);
        return localUri;
      })
      .catch((error) => {
        avatars.delete(uri);
        throw error;
      });
    avatars.set(uri, image);
    return image;
  }
  if (Platform.OS !== 'ios') return Promise.resolve(uri);
  if (!nativeAvatar) return Promise.reject(new Error('Native toolbar avatar is unavailable'));

  const cached = avatars.get(uri);
  if (cached) return cached;
  const image = Image.loadAsync(uri, { maxWidth: 108, maxHeight: 108 })
    .then((image) => nativeAvatar.createCircularImage(image))
    .then((image) => {
      readyAvatars.set(uri, image);
      return image;
    })
    .catch((error) => {
      avatars.delete(uri);
      throw error;
    });
  avatars.set(uri, image);
  return image;
}
