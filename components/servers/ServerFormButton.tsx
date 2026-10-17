import { useAppTheme } from '@/lib/theme';
import { Button } from 'react-native';

export type ServerFormButtonProps = { title: string; disabled?: boolean; onPress: () => void };
export function ServerFormButton(props: ServerFormButtonProps) {
  const theme = useAppTheme();
  return <Button {...props} color={theme.colors.tint} />;
}
