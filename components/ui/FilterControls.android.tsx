import { useAppTheme } from '@/lib/theme';
import { PopupMenu, PopupMenuItem } from '@/modules/native-layout/PopupMenu.android';
import { FilterChip, Host, Icon, Row, Text } from '@expo/ui/jetpack-compose';
import { rotate, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { useRef, useState } from 'react';

import type { FilterButtonProps, FilterChoiceProps, FilterRowProps } from './filterControlTypes';

export function FilterRow({ children, spacing = 8, style }: FilterRowProps) {
  const theme = useAppTheme();
  return (
    <Host matchContents colorScheme={theme.colorScheme} style={[{ height: 48 }, style]}>
      <Row horizontalArrangement={{ spacedBy: spacing }} verticalAlignment="center">
        {children}
      </Row>
    </Host>
  );
}

export function FilterChoice({ label, active, onPress }: FilterChoiceProps) {
  return (
    <FilterChip selected={active} onClick={onPress} elevation={0}>
      <FilterChip.Label>
        <Text style={{ typography: 'labelLarge', fontSize: 13 }}>{label}</Text>
      </FilterChip.Label>
    </FilterChip>
  );
}

export function FilterButton({ label, title, options, onSelect }: FilterButtonProps) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const [optionsMounted, setOptionsMounted] = useState(false);
  const menuOpen = useRef(false);
  const close = () => {
    menuOpen.current = false;
    setExpanded(false);
  };
  return (
    <PopupMenu
      expanded={expanded}
      onDismissRequest={close}
      onDismissed={() => {
        if (!menuOpen.current) setOptionsMounted(false);
      }}
      color={theme.colors.background}
      textColor={theme.colors.text}
    >
      <PopupMenu.Trigger>
        <FilterChip
          selected={false}
          onClick={() => {
            menuOpen.current = true;
            setOptionsMounted(true);
            setExpanded(true);
          }}
          elevation={0}
          modifiers={[semantics({ contentDescription: title ?? label })]}
        >
          <FilterChip.Label>
            <Text style={{ typography: 'labelLarge', fontSize: 13 }}>{label}</Text>
          </FilterChip.Label>
          <FilterChip.TrailingIcon>
            <Icon
              source={require('../../assets/drawables/chevron_left.xml')}
              size={16}
              tint={theme.colors.textSecondary}
              modifiers={[rotate(-90)]}
            />
          </FilterChip.TrailingIcon>
        </FilterChip>
      </PopupMenu.Trigger>
      <PopupMenu.Items>
        {optionsMounted &&
          options.map((option) => (
            <PopupMenuItem
              key={option.value ?? '__all__'}
              selected={option.active}
              onClick={() => {
                close();
                onSelect(option.value);
              }}
            >
              <PopupMenuItem.Text>
                <Text color={theme.colors.text} style={{ fontSize: 16 }}>
                  {option.label}
                </Text>
              </PopupMenuItem.Text>
              {option.active ? (
                <PopupMenuItem.TrailingIcon>
                  <Icon
                    source={require('../../assets/drawables/check.xml')}
                    size={20}
                    tint={theme.colors.tint}
                  />
                </PopupMenuItem.TrailingIcon>
              ) : null}
            </PopupMenuItem>
          ))}
      </PopupMenu.Items>
    </PopupMenu>
  );
}
