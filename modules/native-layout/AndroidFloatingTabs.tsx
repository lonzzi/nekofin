import { requireNativeView } from 'expo';
import { processColor, type NativeSyntheticEvent, type ViewProps } from 'react-native';

type FloatingTabsProps = ViewProps & {
  destinations: readonly {
    key: string;
    title: string;
    drawable: string;
    role: 'tab' | 'search';
  }[];
  selected: string;
  dark: boolean;
  collapsed: boolean;
  kind?: 'destinations' | 'sidebar';
  tintColor: string;
  textColor: string;
  onDestinationSelected: (event: NativeSyntheticEvent<{ key: string }>) => void;
  onToggleSidebar: () => void;
};

const NativeFloatingTabs = requireNativeView<
  Omit<FloatingTabsProps, 'tintColor' | 'textColor'> & {
    selectedColor: ReturnType<typeof processColor>;
    unselectedColor: ReturnType<typeof processColor>;
  }
>('NativeLayout', 'FloatingTabsView');

export function AndroidFloatingTabs({ tintColor, textColor, ...props }: FloatingTabsProps) {
  return (
    <NativeFloatingTabs
      {...props}
      selectedColor={processColor(tintColor)}
      unselectedColor={processColor(textColor)}
    />
  );
}
