import { useAppTheme } from '@/lib/theme';
import { Button, Host, RNHostView, Row, Text } from '@expo/ui';
import { ActivityIndicator } from 'react-native';

export type ServerFormButtonProps = {
  title: string;
  disabled?: boolean;
  busy?: boolean;
  color?: string;
  variant?: 'filled' | 'text';
  onPress: () => void;
};
export function ServerFormButton({
  title,
  disabled,
  busy = false,
  color,
  variant = 'filled',
  onPress,
}: ServerFormButtonProps) {
  const theme = useAppTheme();
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
      <Button
        onPress={onPress}
        disabled={disabled || busy}
        variant={variant}
        style={{ height: 52, width: '100%' }}
      >
        <Row alignment="center" spacing={8}>
          {busy ? (
            <RNHostView matchContents>
              <ActivityIndicator
                size="small"
                color={contentColor}
                style={{ width: 20, height: 20 }}
              />
            </RNHostView>
          ) : null}
          <Text textStyle={{ color: contentColor }}>{title}</Text>
        </Row>
      </Button>
    </Host>
  );
}
