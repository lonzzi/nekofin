import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  const { accentColor } = useAccentColor();
  const theme = useAppTheme();

  return (
    <NativeTabs
      backgroundColor="transparent"
      blurEffect="systemUltraThinMaterial"
      minimizeBehavior="onScrollDown"
      shadowColor="transparent"
    >
      <NativeTabs.Trigger
        name="(servers)"
        contentStyle={{ backgroundColor: theme.colors.background }}
      >
        <NativeTabs.Trigger.Label>服务器</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="storage"
          sf={{ default: 'server.rack', selected: 'server.rack' }}
          selectedColor={accentColor}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role={isLiquidGlassAvailable() ? 'search' : undefined}>
        <NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="search"
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          selectedColor={accentColor}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Label>设置</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="settings"
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          selectedColor={accentColor}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
