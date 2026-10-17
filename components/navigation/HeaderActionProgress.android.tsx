import { useAppTheme } from '@/lib/theme';
import { CircularProgressIndicator } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';

import { HeaderIconButton } from './HeaderIconButton.android';

export function HeaderActionProgress({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <HeaderIconButton enabled={false}>
      <CircularProgressIndicator
        color={theme.colors.tint}
        modifiers={[size(20, 20), semantics({ contentDescription: label })]}
      />
    </HeaderIconButton>
  );
}
