import { requireNativeView } from 'expo';
import type { ComponentType, PropsWithChildren } from 'react';
import type { ColorValue } from 'react-native';

type PopupMenuProps = PropsWithChildren<{
  expanded: boolean;
  onDismissRequest: () => void;
  color: ColorValue;
  textColor: ColorValue;
  alignEnd?: boolean;
}>;

const NativePopup: ComponentType<PopupMenuProps> = requireNativeView(
  'NativeLayout',
  'PopupMenuView',
);
const NativeItem: ComponentType<
  PropsWithChildren<{
    enabled?: boolean;
    selected?: boolean;
    onItemPressed: () => void;
  }>
> = requireNativeView('NativeLayout', 'PopupMenuItemView');
const NativeSubmenu: ComponentType<
  PropsWithChildren<{
    title: string;
    enabled?: boolean;
  }>
> = requireNativeView('NativeLayout', 'PopupSubmenuView');
const Slot: ComponentType<PropsWithChildren<{ slotName: string }>> = requireNativeView(
  'ExpoUI',
  'SlotView',
);

function Items({ children }: PropsWithChildren) {
  return <Slot slotName="items">{children}</Slot>;
}
function Text({ children }: PropsWithChildren) {
  return <Slot slotName="text">{children}</Slot>;
}
function LeadingIcon({ children }: PropsWithChildren) {
  return <Slot slotName="leadingIcon">{children}</Slot>;
}
function TrailingIcon({ children }: PropsWithChildren) {
  return <Slot slotName="trailingIcon">{children}</Slot>;
}
function Trigger({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export const PopupMenu = Object.assign(NativePopup, { Items, Trigger, Submenu: NativeSubmenu });
export const PopupMenuItem = Object.assign(
  ({
    onClick,
    ...props
  }: PropsWithChildren<{
    enabled?: boolean;
    selected?: boolean;
    onClick: () => void;
  }>) => <NativeItem {...props} onItemPressed={onClick} />,
  { Text, LeadingIcon, TrailingIcon },
);
