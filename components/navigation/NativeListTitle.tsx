import { Stack } from 'expo-router';

import { nativeListTitleOptions } from './nativeListStackOptions';

/** Match the stack's title policy in loading, empty and populated list states. */
export function NativeListTitle({ children }: { children: string }) {
  return <Stack.Title large={nativeListTitleOptions.headerLargeTitle}>{children}</Stack.Title>;
}
