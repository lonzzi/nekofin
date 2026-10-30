import { createAppTheme, useAppTheme } from '@/lib/theme';
import { PopupMenu, PopupMenuItem } from '@/modules/native-layout/PopupMenu.android';
import { Box, Column, HorizontalDivider, Host, Icon, Text } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import type {
  MenuComponentProps,
  MenuComponentRef,
  MenuAction as NativeMenuAction,
} from '@react-native-menu/menu';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export type { MenuComponentRef, NativeActionEvent } from '@react-native-menu/menu';
export type MenuAction = Omit<NativeMenuAction, 'image' | 'subactions' | 'imageColor'> & {
  image?: string | ImageSourcePropType;
  imageColor?: NativeMenuAction['imageColor'] | null;
  subactions?: MenuAction[];
};
type Props = Omit<MenuComponentProps, 'actions'> & ViewProps & { actions: MenuAction[] };

const resourceIcons: Record<string, ImageSourcePropType> = {
  ic_menu_slideshow: require('../../assets/drawables/film.xml'),
  ic_lock_silent_mode_off: require('../../assets/drawables/volume_up.xml'),
  ic_menu_edit: require('../../assets/drawables/chat_bubble.xml'),
  ic_menu_manage: require('../../assets/drawables/settings.xml'),
  ic_media_play: require('../../assets/drawables/play_arrow.xml'),
  ic_menu_info_details: require('../../assets/drawables/info.xml'),
  ic_menu_favorite: require('../../assets/drawables/heart_outline.xml'),
  ic_menu_view: require('../../assets/drawables/checkmark_circle.xml'),
  ic_menu_view_off: require('../../assets/drawables/checkmark_circle_outline.xml'),
  ic_menu_person: require('../../assets/drawables/person.xml'),
  ic_menu_delete: require('../../assets/drawables/delete.xml'),
};

function menuColor(value: MenuAction['titleColor'], fallback: string): string {
  if (typeof value === 'number') {
    return `rgba(${(value >>> 16) & 255},${(value >>> 8) & 255},${value & 255},${(value >>> 24) / 255})`;
  }
  return typeof value === 'string' ? value : fallback;
}

/** Preserve existing action IDs/callbacks while sharing Android's custom native popup. */
export const MenuView = forwardRef<MenuComponentRef, Props>(function MenuView(
  {
    actions,
    children,
    style,
    title,
    themeVariant,
    isAnchoredToRight,
    shouldOpenOnLongPress,
    onOpenMenu,
    onCloseMenu,
    onPressAction,
    accessibilityLabel,
    accessibilityState,
    ...viewProps
  },
  ref,
) {
  const appTheme = useAppTheme();
  const theme =
    themeVariant === 'dark' || themeVariant === 'light'
      ? createAppTheme({ colorScheme: themeVariant })
      : appTheme;
  const [expanded, setExpanded] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const isOpen = useRef(false);
  const closeCallback = useRef(onCloseMenu);
  closeCallback.current = onCloseMenu;
  const open = () => {
    if (isOpen.current) return;
    isOpen.current = true;
    setMenuMounted(true);
    setExpanded(true);
    onOpenMenu?.();
  };
  const close = useCallback(() => {
    if (!isOpen.current) return;
    isOpen.current = false;
    setExpanded(false);
    closeCallback.current?.();
  }, []);
  useImperativeHandle(ref, () => ({ show: open }));
  useEffect(
    () => () => {
      if (isOpen.current) closeCallback.current?.();
    },
    [],
  );

  const renderActions = (items: MenuAction[], path = 'menu'): React.ReactNode =>
    items.map((action, index) => {
      if (action.attributes?.hidden) return null;
      const key = `${path}:${index}`;
      if (action.subactions?.length && action.displayInline) {
        return (
          <Column key={key}>
            {index > 0 ? <HorizontalDivider /> : null}
            {renderActions(action.subactions, key)}
          </Column>
        );
      }
      const color = menuColor(
        action.titleColor,
        action.attributes?.destructive ? theme.colors.danger : theme.colors.text,
      );
      const image = typeof action.image === 'string' ? resourceIcons[action.image] : action.image;
      const content = (
        <>
          {image ? (
            <PopupMenuItem.LeadingIcon>
              <Icon
                source={image}
                tint={action.imageColor === null ? null : menuColor(action.imageColor, color)}
                size={24}
              />
            </PopupMenuItem.LeadingIcon>
          ) : null}
          <PopupMenuItem.Text>
            <Column>
              <Text color={color} style={{ fontSize: 16 }}>
                {action.title}
              </Text>
              {action.subtitle ? (
                <Text color={theme.colors.textSecondary} style={{ fontSize: 13 }}>
                  {action.subtitle}
                </Text>
              ) : null}
            </Column>
          </PopupMenuItem.Text>
        </>
      );
      if (action.subactions?.length) {
        return (
          <PopupMenu.Submenu key={key} title={action.title} enabled={!action.attributes?.disabled}>
            {content}
            <PopupMenu.Items>{renderActions(action.subactions, key)}</PopupMenu.Items>
          </PopupMenu.Submenu>
        );
      }
      return (
        <PopupMenuItem
          key={key}
          enabled={!action.attributes?.disabled}
          selected={action.state === undefined ? undefined : action.state !== 'off'}
          onClick={() => {
            if (!action.attributes?.keepsMenuPresented) close();
            onPressAction?.({ nativeEvent: { event: action.id ?? '' } });
          }}
        >
          {content}
          {action.state === 'on' || action.state === 'mixed' ? (
            <PopupMenuItem.TrailingIcon>
              <Icon
                source={require('../../assets/drawables/check.xml')}
                size={20}
                tint={theme.colors.tint}
              />
            </PopupMenuItem.TrailingIcon>
          ) : null}
        </PopupMenuItem>
      );
    });

  if (shouldOpenOnLongPress) {
    // Let child cards and their secondary buttons keep normal tap handling.
    // Activating the native long-press gesture cancels the pending child press.
    const longPress = Gesture.LongPress().runOnJS(true).onStart(open);
    return (
      <GestureDetector gesture={longPress}>
        <View
          {...viewProps}
          collapsable={false}
          style={style}
          accessibilityLabel={accessibilityLabel ?? title}
          accessibilityState={{ ...accessibilityState, expanded }}
        >
          {children}
          {menuMounted ? (
            <Host
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              colorScheme={theme.colorScheme}
            >
              <PopupMenu
                expanded={expanded}
                onDismissRequest={close}
                onDismissed={() => {
                  if (!isOpen.current) setMenuMounted(false);
                }}
                color={theme.colors.background}
                textColor={theme.colors.text}
                alignEnd={isAnchoredToRight}
              >
                <Box modifiers={[fillMaxSize()]} />
                <PopupMenu.Items>{renderActions(actions)}</PopupMenu.Items>
              </PopupMenu>
            </Host>
          ) : null}
        </View>
      </GestureDetector>
    );
  }

  return (
    <Pressable
      {...viewProps}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ ...accessibilityState, expanded }}
      onPress={shouldOpenOnLongPress ? undefined : open}
      onLongPress={shouldOpenOnLongPress ? open : undefined}
    >
      <View
        style={{ flexGrow: 1 }}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>
      <Host style={StyleSheet.absoluteFill} colorScheme={theme.colorScheme}>
        <PopupMenu
          expanded={expanded}
          onDismissRequest={close}
          color={theme.colors.background}
          textColor={theme.colors.text}
          alignEnd={isAnchoredToRight}
        >
          <Box
            modifiers={[
              fillMaxSize(),
              combinedClickable(
                {
                  onClick: shouldOpenOnLongPress ? undefined : open,
                  onLongClick: shouldOpenOnLongPress ? open : undefined,
                },
                { indication: false },
              ),
            ]}
          />
          <PopupMenu.Items>{renderActions(actions)}</PopupMenu.Items>
        </PopupMenu>
      </Host>
    </Pressable>
  );
});
