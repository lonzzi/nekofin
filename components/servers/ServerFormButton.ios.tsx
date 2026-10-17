import { useAppTheme } from '@/lib/theme';
import { Button, Host, HStack, ProgressView, Text } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, frame } from '@expo/ui/swift-ui/modifiers';

import type { ServerFormButtonProps } from './ServerFormButton';

export function ServerFormButton({
  title,
  disabled: isDisabled,
  busy = false,
  color,
  variant = 'filled',
  onPress,
}: ServerFormButtonProps) {
  const theme = useAppTheme();
  return (
    <Host
      style={{ height: 52, width: '100%' }}
      colorScheme={theme.colorScheme}
      seedColor={color ?? theme.colors.tint}
    >
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(variant === 'text' ? 'borderless' : 'borderedProminent'),
          controlSize('large'),
          disabled(!!isDisabled || busy),
        ]}
      >
        <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
          {busy ? <ProgressView modifiers={[controlSize('small')]} /> : null}
          <Text>{title}</Text>
        </HStack>
      </Button>
    </Host>
  );
}
