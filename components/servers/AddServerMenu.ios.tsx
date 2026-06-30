import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, Text, View } from 'react-native';
import { ContextMenuButton, type MenuConfig } from 'react-native-ios-context-menu';

const addServerMenuConfig: MenuConfig = {
  menuTitle: '',
  menuItems: [
    {
      actionKey: 'jellyfin',
      actionTitle: 'Jellyfin',
      icon: {
        type: 'IMAGE_ASSET',
        imageValue: 'jellyfin-icon--color-on-light',
      },
    },
    {
      actionKey: 'emby',
      actionTitle: 'Emby',
      icon: {
        type: 'IMAGE_ASSET',
        imageValue: 'emby',
      },
    },
  ],
};

type AddServerMenuProps = {
  onSelect: (serverType: MediaServerType) => void;
  variant?: 'icon' | 'text';
};

export function AddServerMenu({ onSelect, variant = 'icon' }: AddServerMenuProps) {
  const theme = useAppTheme();
  const useGlass = isLiquidGlassAvailable();

  const handleSelect = ({ nativeEvent }: { nativeEvent: { actionKey: string } }) => {
    onSelect(nativeEvent.actionKey as MediaServerType);
  };

  if (variant === 'text') {
    return (
      <ContextMenuButton
        isMenuPrimaryAction
        menuConfig={addServerMenuConfig}
        onPressMenuItem={handleSelect}
      >
        <Text
          style={[
            styles.textTrigger,
            { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.tint },
          ]}
        >
          添加服务器
        </Text>
      </ContextMenuButton>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: useGlass ? 'transparent' : theme.colors.surfaceMuted },
        ]}
      >
        <Ionicons name="add" size={22} color={theme.colors.text} />
      </View>
      <ContextMenuButton
        accessibilityRole="button"
        accessibilityLabel="添加媒体账号"
        isMenuPrimaryAction
        menuConfig={addServerMenuConfig}
        onPressMenuItem={handleSelect}
        style={styles.menuOverlay}
      >
        <View style={styles.menuOverlayContent} />
      </ContextMenuButton>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  menuOverlayContent: {
    flex: 1,
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
