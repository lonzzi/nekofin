import type { PropsWithChildren } from 'react';

import { readContextMenu } from './contextMenuModel';
import { MenuView } from './MenuView.android';

export { Content, Item, ItemIcon, ItemTitle, Trigger } from './contextMenuModel';

/** Card context menus use the same Android material and rows as other menus. */
export function Root({ children }: PropsWithChildren<{ __unsafeIosProps?: unknown }>) {
  const { trigger, entries } = readContextMenu(children);
  return (
    <MenuView
      shouldOpenOnLongPress
      actions={entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        image: entry.image,
        attributes: {
          disabled: entry.disabled,
          destructive: entry.destructive,
          hidden: entry.hidden,
        },
      }))}
      onPressAction={({ nativeEvent }) => {
        entries.find((entry) => entry.id === nativeEvent.event)?.onSelect?.();
      }}
    >
      {trigger}
    </MenuView>
  );
}
