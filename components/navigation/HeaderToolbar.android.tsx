import { useAppTheme } from '@/lib/theme';
import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  Icon,
  Image,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { clip, rotate, Shapes, size } from '@expo/ui/jetpack-compose/modifiers';
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
        style={{ width: items.length * 48 + Math.max(0, items.length - 1) * 8, height: 48 }}
        colorScheme={theme.colorScheme}
        matchContents
      >
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
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
        size={24}
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
  iconSize = 24,
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
  const avatarSource =
    avatar && icon && typeof icon === 'object' && !Array.isArray(icon) && 'uri' in icon
      ? icon
      : undefined;
  return (
    <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
      <DropdownMenu.Trigger>
        {parentClose ? (
          <DropdownMenuItem onClick={() => setExpanded(true)} enabled={!disabled}>
            <DropdownMenuItem.Text>
              <Text color={theme.colors.text}>{title}</Text>
            </DropdownMenuItem.Text>
            <DropdownMenuItem.TrailingIcon>
              <Icon
                source={require('../../assets/drawables/chevron_left.png')}
                size={24}
                tint={theme.colors.textSecondary}
                modifiers={[rotate(180)]}
              />
            </DropdownMenuItem.TrailingIcon>
          </DropdownMenuItem>
        ) : (
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
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <CloseMenuContext.Provider value={close}>{children}</CloseMenuContext.Provider>
      </DropdownMenu.Items>
    </DropdownMenu>
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
}: ComponentProps<typeof Stack.Toolbar.MenuAction>) {
  const close = useContext(CloseMenuContext);
  const theme = useAppTheme();
  if (hidden) return null;
  const color = destructive ? theme.colors.danger : theme.colors.text;
  return (
    <DropdownMenuItem
      enabled={!disabled}
      onClick={() => {
        onPress?.();
        if (!unstable_keepPresented) close?.();
      }}
    >
      {icon && typeof icon !== 'string' ? (
        <DropdownMenuItem.LeadingIcon>
          <Icon source={icon} size={24} tint={iconRenderingMode === 'original' ? null : color} />
        </DropdownMenuItem.LeadingIcon>
      ) : null}
      <DropdownMenuItem.Text>
        <Text color={color}>{children}</Text>
      </DropdownMenuItem.Text>
      {isOn ? (
        <DropdownMenuItem.TrailingIcon>
          <Icon
            source={require('../../assets/drawables/checkmark_circle.png')}
            size={20}
            tint={theme.colors.tint}
          />
        </DropdownMenuItem.TrailingIcon>
      ) : null}
    </DropdownMenuItem>
  );
}

export function HeaderLabel(_: ComponentProps<typeof Stack.Toolbar.Label>) {
  return null;
}
