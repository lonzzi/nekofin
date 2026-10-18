import { createContext, createElement, useContext } from 'react';
import { Text, type ColorValue } from 'react-native';

/** Space available beside Android's floating tabs, including on pushed screens. */
export const TabletChromeContext = createContext<{
  titleMaxWidth: number;
  leadingWidth: number;
  toolbarHeight: number;
} | null>(null);

export function TabletHeaderTitle({
  children,
  tintColor,
}: {
  children?: string;
  tintColor?: ColorValue;
}) {
  const chrome = useContext(TabletChromeContext);
  return createElement(
    Text,
    {
      numberOfLines: 1,
      style: {
        maxWidth: chrome?.titleMaxWidth,
        marginLeft: chrome?.leadingWidth,
        color: tintColor,
        fontSize: 20,
        fontWeight: '500',
      },
    },
    children,
  );
}
