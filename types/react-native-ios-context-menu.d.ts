declare module 'react-native-ios-context-menu' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';

  export type MenuConfig = {
    menuTitle: string;
    menuItems?: {
      actionKey: string;
      actionTitle: string;
      icon?: {
        type?: 'IMAGE_ASSET' | 'IMAGE_SYSTEM' | 'IMAGE_REQUIRE' | 'IMAGE_EMPTY';
        imageValue?: unknown;
        iconType?: 'ASSET' | 'SYSTEM' | 'REQUIRE' | 'NONE';
        iconValue?: unknown;
      };
    }[];
  };

  export type ContextMenuButtonProps = ViewProps & {
    children?: ReactNode;
    isMenuPrimaryAction?: boolean;
    menuConfig?: MenuConfig;
    onPressMenuItem?: (event: {
      nativeEvent: {
        actionKey: string;
        actionTitle?: string;
      };
    }) => void;
  };

  export const ContextMenuButton: ComponentType<ContextMenuButtonProps>;
}
