import { useAppTheme } from '@/lib/theme';
import {
  Button,
  CircularProgressIndicator,
  Host,
  Row,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, size } from '@expo/ui/jetpack-compose/modifiers';

import type { ServerFormButtonProps } from './ServerFormButton';

export function ServerFormButton({
  title,
  disabled,
  busy = false,
  color,
  variant = 'filled',
  onPress,
}: ServerFormButtonProps) {
  const theme = useAppTheme();
  const NativeButton = variant === 'text' ? TextButton : Button;
  const contentColor =
    disabled || busy
      ? theme.colors.textSecondary
      : variant === 'text'
        ? (color ?? theme.colors.tint)
        : theme.colors.inverseText;
  return (
    <Host
      style={{ height: 52, width: '100%' }}
      colorScheme={theme.colorScheme}
      seedColor={color ?? theme.colors.tint}
    >
      <NativeButton
        onClick={onPress}
        enabled={!disabled && !busy}
        modifiers={[fillMaxWidth(), height(52)]}
      >
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          {busy ? (
            <CircularProgressIndicator color={contentColor} modifiers={[size(20, 20)]} />
          ) : null}
          <Text color={contentColor}>{title}</Text>
        </Row>
      </NativeButton>
    </Host>
  );
}
