import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, type ImageSourcePropType } from 'react-native';

// Expo UI's Android Icon supports null tint for original colors, but MenuAction
// currently types imageColor as ColorValue only.
const originalIconColor = null as unknown as MenuAction['imageColor'];

function resolveMenuIcon(source: ImageSourcePropType): ImageSourcePropType {
  const resolved = Image.resolveAssetSource(source);
  return resolved?.uri ? { uri: resolved.uri } : source;
}

const addServerActions: MenuAction[] = [
  {
    id: 'jellyfin',
    title: 'Jellyfin',
    image: resolveMenuIcon(require('../../assets/icons/jellyfin-icon--color-on-light.png')),
    imageColor: originalIconColor,
  },
  {
    id: 'emby',
    title: 'Emby',
    image: resolveMenuIcon(require('../../assets/drawables/emby.xml')),
    imageColor: originalIconColor,
  },
];

type AddServerMenuProps = {
  onSelect: (serverType: MediaServerType) => void;
  variant?: 'icon' | 'text';
};

export function AddServerMenu({ onSelect, variant = 'icon' }: AddServerMenuProps) {
  const theme = useAppTheme();

  return (
    <MenuView
      actions={addServerActions}
      onPressAction={({ nativeEvent }) => {
        onSelect(nativeEvent.event as MediaServerType);
      }}
    >
      {variant === 'text' ? (
        <Text
          style={[
            styles.textTrigger,
            { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.tint },
          ]}
        >
          添加服务器
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="添加媒体账号"
          hitSlop={10}
          style={[styles.iconTrigger, { backgroundColor: theme.colors.surfaceElevated }]}
        >
          <Ionicons name="add" size={22} color={theme.colors.text} />
        </Pressable>
      )}
    </MenuView>
  );
}

const styles = StyleSheet.create({
  iconTrigger: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textTrigger: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 19,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});
