import { useAppTheme } from '@/lib/theme';
import {
  DropdownMenu,
  DropdownMenuItem,
  FilterChip,
  Host,
  Icon,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { rotate, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';

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
  return (
    <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
      <DropdownMenu.Trigger>
        <FilterChip
          selected={false}
          onClick={() => setExpanded(true)}
          elevation={0}
          modifiers={[semantics({ contentDescription: title ?? label })]}
        >
          <FilterChip.Label>
            <Text style={{ typography: 'labelLarge', fontSize: 13 }}>{label}</Text>
          </FilterChip.Label>
          <FilterChip.TrailingIcon>
            <Icon
              source={require('../../assets/drawables/chevron_left.png')}
              size={16}
              tint={theme.colors.textSecondary}
              modifiers={[rotate(-90)]}
            />
          </FilterChip.TrailingIcon>
        </FilterChip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value ?? '__all__'}
            onClick={() => {
              setExpanded(false);
              onSelect(option.value);
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{option.label}</Text>
            </DropdownMenuItem.Text>
            {option.active ? (
              <DropdownMenuItem.TrailingIcon>
                <Icon
                  source={require('../../assets/drawables/checkmark_circle.png')}
                  size={20}
                  tint={theme.colors.tint}
                />
              </DropdownMenuItem.TrailingIcon>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
