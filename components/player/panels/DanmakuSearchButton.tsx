import { useAppTheme } from '@/lib/theme';
import { CircularProgressIndicator, Text, TextButton } from '@expo/ui/jetpack-compose';
import { semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Button, ProgressView } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

export function DanmakuSearchButton({
  disabled,
  loading,
  onPress,
}: {
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const label = loading ? '正在搜索弹幕' : '搜索弹幕';

  if (Platform.OS === 'android') {
    return (
      <TextButton
        enabled={!disabled}
        onClick={onPress}
        colors={{ contentColor: theme.colors.tint }}
        modifiers={[
          size(64, 44),
          semantics({ contentDescription: label }),
          testID('player-danmaku-search-submit'),
        ]}
      >
        {loading ? (
          <CircularProgressIndicator color={theme.colors.tint} modifiers={[size(20, 20)]} />
        ) : (
          <Text>搜索</Text>
        )}
      </TextButton>
    );
  }

  return (
    <Button
      label="搜索"
      onPress={onPress}
      modifiers={[
        buttonStyle('borderless'),
        controlSize('regular'),
        frame({ width: 44, height: 44 }),
        tint(theme.colors.tint),
        disabledModifier(disabled),
        accessibilityLabel(label),
      ]}
      testID="player-danmaku-search-submit"
    >
      {loading ? <ProgressView modifiers={[tint(theme.colors.tint)]} /> : undefined}
    </Button>
  );
}
