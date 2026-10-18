import {
  NAVIGATION_CONTROL_GAP,
  NAVIGATION_CONTROL_SIZE,
  NAVIGATION_ICON_SIZE,
} from '@/lib/navigationMetrics';
import { useAppTheme } from '@/lib/theme';
import { PopupMenu, PopupMenuItem } from '@/modules/native-layout/PopupMenu.android';
import { Column, HorizontalDivider, Host, Icon, Image, Row, Text } from '@expo/ui/jetpack-compose';
import { clip, Shapes, size } from '@expo/ui/jetpack-compose/modifiers';
import { Stack } from 'expo-router';
import { Children, createContext, useContext, useState, type ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { HeaderIconButton } from './HeaderIconButton.android';

const CloseMenuContext = createContext<(() => void) | null>(null);

export function HeaderToolbar({
  children,
  placement = 'right',
}: ComponentProps<typeof Stack.Toolbar>) {
  const theme = useAppTheme();
  const items = Children.toArray(children);
  return (
    <Stack.Toolbar placement={placement} asChild>
      <Host
        style={{
          width:
            items.length * NAVIGATION_CONTROL_SIZE +
            Math.max(0, items.length - 1) * NAVIGATION_CONTROL_GAP,
          height: NAVIGATION_CONTROL_SIZE,
        }}
        colorScheme={theme.colorScheme}
        matchContents
      >
        <Row
          horizontalArrangement={{ spacedBy: NAVIGATION_CONTROL_GAP }}
          verticalAlignment="center"
        >
          {items}
        </Row>
      </Host>
    </Stack.Toolbar>
  );
}

export function HeaderButton({
  icon,
  onPress,
  disabled,
  hidden,
  accessibilityLabel,
  children,
  tintColor,
  iconRenderingMode,
}: ComponentProps<typeof Stack.Toolbar.Button>) {
  const theme = useAppTheme();
  if (hidden || !icon || typeof icon === 'string') return null;
  return (
    <HeaderIconButton onClick={onPress} enabled={!disabled}>
      <Icon
        source={icon}
        size={NAVIGATION_ICON_SIZE}
        tint={iconRenderingMode === 'original' ? null : (tintColor ?? theme.colors.text)}
        contentDescription={
          accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
        }
      />
    </HeaderIconButton>
  );
}

function HeaderAvatar({
  source,
  label,
  diameter,
}: {
  source: ComponentProps<typeof Image>['source'];
  label?: string;
  diameter: number;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Icon
      source={require('../../assets/drawables/account.xml')}
      size={diameter}
      tint={null}
      contentDescription={label}
    />
  ) : (
    <Image
      source={source}
      contentScale="crop"
      alignment="center"
      contentDescription={label}
      modifiers={[size(diameter, diameter), clip(Shapes.Circle)]}
      onError={() => setFailed(true)}
    />
  );
}

export function HeaderMenu({
  children,
  icon,
  disabled,
  hidden,
  inline,
  title,
  accessibilityLabel,
  tintColor,
  iconRenderingMode,
  iconSize = NAVIGATION_ICON_SIZE,
  avatar = false,
}: ComponentProps<typeof Stack.Toolbar.Menu> & { iconSize?: number; avatar?: boolean }) {
  const theme = useAppTheme();
  const parentClose = useContext(CloseMenuContext);
  const [expanded, setExpanded] = useState(false);
  const close = () => {
    setExpanded(false);
    parentClose?.();
  };
  if (hidden) return null;
  if (parentClose && inline)
    return (
      <>
        {children}
        <HorizontalDivider />
      </>
    );
  if (parentClose) {
    return (
      <PopupMenu.Submenu title={title ?? ''} enabled={!disabled}>
        <PopupMenuItem.Text>
          <Text color={theme.colors.text} style={{ fontSize: 16 }}>
            {title}
          </Text>
        </PopupMenuItem.Text>
        <PopupMenu.Items>{children}</PopupMenu.Items>
      </PopupMenu.Submenu>
    );
  }
  const avatarSource =
    avatar && icon && typeof icon === 'object' && !Array.isArray(icon) && 'uri' in icon
      ? icon
      : undefined;
  return (
    <PopupMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      color={theme.colors.background}
      textColor={theme.colors.text}
      alignEnd
    >
      <PopupMenu.Trigger>
        <HeaderIconButton onClick={() => setExpanded(true)} enabled={!disabled}>
          {avatarSource?.uri ? (
            <HeaderAvatar
              key={avatarSource.uri}
              source={{ uri: avatarSource.uri }}
              label={accessibilityLabel}
              diameter={iconSize}
            />
          ) : icon && typeof icon !== 'string' ? (
            <Icon
              source={icon as ImageSourcePropType}
              tint={iconRenderingMode === 'original' ? null : (tintColor ?? theme.colors.text)}
              size={iconSize}
              contentDescription={accessibilityLabel}
            />
          ) : null}
        </HeaderIconButton>
      </PopupMenu.Trigger>
      <PopupMenu.Items>
        <CloseMenuContext.Provider value={close}>{children}</CloseMenuContext.Provider>
      </PopupMenu.Items>
    </PopupMenu>
  );
}

export function HeaderMenuAction({
  children,
  onPress,
  isOn,
  disabled,
  hidden,
  destructive,
  icon,
  iconRenderingMode,
  unstable_keepPresented,
  subtitle,
}: ComponentProps<typeof Stack.Toolbar.MenuAction>) {
  const close = useContext(CloseMenuContext);
  const theme = useAppTheme();
  if (hidden) return null;
  const color = destructive ? theme.colors.danger : theme.colors.text;
  return (
    <PopupMenuItem
      enabled={!disabled}
      selected={isOn}
      onClick={() => {
        onPress?.();
        if (!unstable_keepPresented) close?.();
      }}
    >
      {icon && typeof icon !== 'string' ? (
        <PopupMenuItem.LeadingIcon>
          <Icon source={icon} size={24} tint={iconRenderingMode === 'original' ? null : color} />
        </PopupMenuItem.LeadingIcon>
      ) : null}
      <PopupMenuItem.Text>
        <Column>
          <Text color={color} style={{ fontSize: 16 }}>
            {children}
          </Text>
          {subtitle ? (
            <Text color={theme.colors.textSecondary} style={{ fontSize: 13 }}>
              {subtitle}
            </Text>
          ) : null}
        </Column>
      </PopupMenuItem.Text>
      {isOn ? (
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
}

export function HeaderLabel(_: ComponentProps<typeof Stack.Toolbar.Label>) {
  return null;
}
