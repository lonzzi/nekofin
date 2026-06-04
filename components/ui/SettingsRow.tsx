import { useSettingsColors } from '@/hooks/useSettingsColors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface SettingsRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  imageUri?: string;
  onPress?: () => void;
  showArrow?: boolean;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  menuTitle?: string;
  menuActions?: { id: string; title: string }[];
  onMenuAction?: (actionId: string) => void;
  shouldOpenOnLongPress?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  subtitle,
  icon,
  imageUri,
  onPress,
  showArrow = true,
  leftComponent,
  rightComponent,
  containerStyle,
  menuTitle,
  menuActions,
  onMenuAction,
  shouldOpenOnLongPress = false,
}) => {
  const { textColor, secondaryTextColor, secondarySystemGroupedBackground, accentColor } =
    useSettingsColors();

  const RowContent = (
    <Pressable
      style={[
        styles.settingItem,
        { backgroundColor: secondarySystemGroupedBackground },
        containerStyle,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingItemLeft}>
        {leftComponent}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.settingImage} contentFit="cover" />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={accentColor} style={styles.settingIcon} />
        ) : null}
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, { color: textColor }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.settingSubtitle, { color: secondaryTextColor }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.settingItemRight}>
        {rightComponent}
        {showArrow && onPress ? (
          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        ) : null}
      </View>
    </Pressable>
  );

  if (menuActions && menuActions.length > 0) {
    return (
      <MenuView
        title={menuTitle ?? ''}
        actions={menuActions}
        shouldOpenOnLongPress={shouldOpenOnLongPress}
        onPressAction={({ nativeEvent }) => onMenuAction?.(nativeEvent.event)}
      >
        {RowContent}
      </MenuView>
    );
  }

  return RowContent;
};

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});

export default SettingsRow;
