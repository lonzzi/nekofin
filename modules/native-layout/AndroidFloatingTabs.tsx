import { useTranslation } from '@/lib/i18n';
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
    toggleSidebarLabel: string;
    selectedColor: ReturnType<typeof processColor>;
    unselectedColor: ReturnType<typeof processColor>;
  }
>('NativeLayout', 'FloatingTabsView');

export function AndroidFloatingTabs({ tintColor, textColor, ...props }: FloatingTabsProps) {
  const { t } = useTranslation();
  return (
    <NativeFloatingTabs
      {...props}
      destinations={props.destinations.map((destination) => ({ ...destination }))}
      toggleSidebarLabel={
        props.collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')
      }
      selectedColor={processColor(tintColor)}
      unselectedColor={processColor(textColor)}
    />
  );
}
