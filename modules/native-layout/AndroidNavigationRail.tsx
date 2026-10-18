import { requireNativeView } from 'expo';
import { processColor, type NativeSyntheticEvent, type ViewProps } from 'react-native';

type RailProps = ViewProps & {
  destinations: readonly { key: string; title: string; drawable: string }[];
  servers: readonly { id: string; name: string; type: string; avatarUri: string }[];
  selectedServerId: string;
  selected: string;
  dark: boolean;
  backgroundColor: string;
  tintColor: string;
  textColor: string;
  onDestinationSelected: (event: NativeSyntheticEvent<{ key: string }>) => void;
  onServerSelected: (event: NativeSyntheticEvent<{ id: string }>) => void;
  onToggleSidebar: () => void;
};

const NativeRail = requireNativeView<
  Omit<RailProps, 'backgroundColor' | 'tintColor' | 'textColor'> & {
    surfaceColor: ReturnType<typeof processColor>;
    selectedColor: ReturnType<typeof processColor>;
    unselectedColor: ReturnType<typeof processColor>;
  }
>('NativeLayout', 'NavigationRailView');

export function AndroidNavigationRail({
  backgroundColor,
  tintColor,
  textColor,
  ...props
}: RailProps) {
  return (
    <NativeRail
      {...props}
      surfaceColor={processColor(backgroundColor)}
      selectedColor={processColor(tintColor)}
      unselectedColor={processColor(textColor)}
    />
  );
}
