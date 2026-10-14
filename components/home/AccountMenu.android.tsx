import {
  HeaderMenu,
  HeaderMenuAction,
  HeaderToolbar,
} from '@/components/navigation/HeaderToolbar.android';
import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

export const AccountToolbar = HeaderToolbar;
export const AccountMenuAction = HeaderMenuAction;

export function AccountMenu(props: ComponentProps<typeof Stack.Toolbar.Menu>) {
  return <HeaderMenu {...props} avatar iconSize={36} />;
}
