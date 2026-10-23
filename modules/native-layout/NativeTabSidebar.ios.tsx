import { requireNativeView } from 'expo';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

type NativeTabSidebarProps = ViewProps & {
  servers: readonly { id: string; name: string; type: string; avatarUri: string }[];
  selectedServerId: string;
  serversTitle: string;
  onServerSelected: (event: NativeSyntheticEvent<{ id: string }>) => void;
};

/** Adds server shortcuts through UIKit's public sidebar content configuration. */
export const NativeTabSidebar = requireNativeView<NativeTabSidebarProps>(
  'NativeLayout',
  'TabSidebarView',
);
