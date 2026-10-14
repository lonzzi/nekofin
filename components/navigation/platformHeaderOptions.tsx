import type { ReactNode } from 'react';

export type PlatformHeaderOptions = {
  headerBackVisible?: boolean;
  headerLeft?: (props: { canGoBack?: boolean }) => ReactNode;
};

export const platformHeaderOptions: PlatformHeaderOptions = {};
