import { useAppTheme } from '@/lib/theme';
import { Column } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { Children, type ComponentProps } from 'react';

import { settingsLayout } from './settingsLayout';

type NativeSettingsGroupProps = Pick<ComponentProps<typeof Column>, 'children' | 'modifiers'>;

/** Compose rows inside an existing group; children must be native Compose content. */
export function NativeSettingsRows({ children, modifiers = [] }: NativeSettingsGroupProps) {
  const theme = useAppTheme();
  return (
    <Column
      verticalArrangement={{ spacedBy: settingsLayout.rowGap }}
      modifiers={[fillMaxWidth(), ...modifiers, background(theme.colors.backgroundGrouped)]}
    >
      {Children.map(children, (child) =>
        child ? (
          <Column
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(settingsLayout.rowRadius)),
              background(theme.colors.surface),
            ]}
          >
            {child}
          </Column>
        ) : null,
      )}
    </Column>
  );
}

/** A complete rounded group, normally rendered by NativeSettingsSection. */
export function NativeSettingsGroup({ children }: Pick<NativeSettingsGroupProps, 'children'>) {
  return (
    <NativeSettingsRows modifiers={[clip(Shapes.RoundedCorner(settingsLayout.groupRadius))]}>
      {children}
    </NativeSettingsRows>
  );
}
