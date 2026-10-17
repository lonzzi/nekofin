import { useAppTheme } from '@/lib/theme';
import { Button, Host, Text } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, frame } from '@expo/ui/swift-ui/modifiers';

import type { ServerFormButtonProps } from './ServerFormButton';

export function ServerFormButton({ title, disabled: isDisabled, onPress }: ServerFormButtonProps) {
  const theme = useAppTheme();
  return (
    <Host
      style={{ height: 52, width: '100%' }}
      colorScheme={theme.colorScheme}
      seedColor={theme.colors.tint}
    >
      <Button
        onPress={onPress}
        modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!!isDisabled)]}
      >
        <Text modifiers={[frame({ maxWidth: Infinity })]}>{title}</Text>
      </Button>
    </Host>
  );
}
