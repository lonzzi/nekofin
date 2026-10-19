import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';

export type ContextMenuItemProps = PropsWithChildren<{
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hidden?: boolean;
}>;
type IconProps = { ios?: { name: string }; androidIconName?: string };

// Android reads these declarations into the shared native popup. They do not
// mount another menu implementation or intercept the card's normal presses.
export function Trigger({ children }: PropsWithChildren) {
  return createElement(Fragment, null, children);
}
export function Content({ children }: PropsWithChildren) {
  return createElement(Fragment, null, children);
}
export function Item({ children }: ContextMenuItemProps) {
  return createElement(Fragment, null, children);
}
export function ItemTitle({ children }: PropsWithChildren) {
  return createElement(Fragment, null, children);
}
export function ItemIcon(_props: IconProps) {
  return null;
}

type Element = ReactElement<PropsWithChildren>;
function elements(children: ReactNode): Element[] {
  const result: Element[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<PropsWithChildren>(child)) return;
    if (child.type === Fragment) result.push(...elements(child.props.children));
    else result.push(child);
  });
  return result;
}
function text(children: ReactNode): string {
  let result = '';
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') result += child;
    else if (isValidElement<PropsWithChildren>(child)) result += text(child.props.children);
  });
  return result;
}

export type ContextMenuEntry = {
  id: string;
  title: string;
  disabled?: boolean;
  destructive?: boolean;
  hidden?: boolean;
  image?: string;
  onSelect?: () => void;
};
const icons: Record<string, string> = {
  film: 'ic_menu_slideshow',
  settings: 'ic_menu_manage',
  people: 'ic_menu_person',
  delete: 'ic_menu_delete',
  'play.circle': 'ic_media_play',
  'info.circle': 'ic_menu_info_details',
  heart: 'ic_menu_favorite',
  eye: 'ic_menu_view',
  'eye.slash': 'ic_menu_view_off',
};

export function readContextMenu(children: ReactNode): {
  trigger: ReactNode;
  entries: ContextMenuEntry[];
} {
  const root = elements(children);
  const trigger = root.find((child) => child.type === Trigger)?.props.children;
  const content = root.find((child) => child.type === Content);
  const entries = elements(content?.props.children)
    .filter((child) => child.type === Item)
    .map((node, index): ContextMenuEntry => {
      const props = node.props as ContextMenuItemProps;
      const children = elements(props.children);
      const title = children.find((child) => child.type === ItemTitle);
      const icon = children.find((child) => child.type === ItemIcon)?.props as
        | IconProps
        | undefined;
      return {
        id: node.key ?? `item-${index}`,
        title: text(title?.props.children),
        disabled: props.disabled,
        destructive: props.destructive,
        hidden: props.hidden,
        image: icons[icon?.androidIconName ?? icon?.ios?.name ?? ''],
        onSelect: props.onSelect,
      };
    });
  return { trigger, entries };
}
