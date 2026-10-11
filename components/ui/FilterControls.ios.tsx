import { useAppTheme } from '@/lib/theme';
import { Button, GlassEffectContainer, Host, HStack, Menu, Toggle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  fixedSize,
  font,
  menuIndicator,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

import type { FilterButtonProps, FilterChoiceProps, FilterRowProps } from './filterControlTypes';

const supportsLiquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export function FilterRow({ children, spacing = 8, style }: FilterRowProps) {
  const theme = useAppTheme();

  return (
    <Host matchContents colorScheme={theme.colorScheme} ignoreSafeArea="all" style={style}>
      <GlassEffectContainer spacing={spacing}>
        <HStack spacing={spacing} modifiers={[fixedSize(), padding({ vertical: 4 })]}>
          {children}
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}

export function FilterButton({ label, title, options, onSelect }: FilterButtonProps) {
  const theme = useAppTheme();

  return (
    <Menu
      label={label}
      modifiers={[
        // A native button style also handles the menu's dismiss animation.
        buttonStyle(supportsLiquidGlass ? 'glass' : 'bordered'),
        buttonBorderShape('capsule'),
        menuIndicator('visible'),
        controlSize('large'),
        font({ textStyle: 'subheadline', weight: 'medium' }),
        tint(theme.colors.text),
        accessibilityLabel(title ?? label),
      ]}
    >
      {options.map((option) => (
        <Toggle
          key={option.value ?? '__all__'}
          label={option.label}
          isOn={!!option.active}
          onIsOnChange={() => onSelect(option.value)}
        />
      ))}
    </Menu>
  );
}

export function FilterChoice({ label, active, onPress }: FilterChoiceProps) {
  const theme = useAppTheme();

  return (
    <Button
      label={label}
      onPress={onPress}
      modifiers={[
        buttonStyle(
          supportsLiquidGlass
            ? active
              ? 'glassProminent'
              : 'glass'
            : active
              ? 'borderedProminent'
              : 'bordered',
        ),
        buttonBorderShape('capsule'),
        controlSize('large'),
        font({ textStyle: 'subheadline', weight: 'medium' }),
        tint(active ? theme.colors.tint : theme.colors.text),
        ...(active ? [accessibilityAddTraits(['isSelected'])] : []),
      ]}
    />
  );
}
