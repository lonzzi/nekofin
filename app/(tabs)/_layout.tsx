import { TabletNavigation } from '@/components/navigation/TabletNavigation';
import { useAppTheme } from '@/lib/theme';
import { useOuterTheme } from '@/lib/theme/OuterTheme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

export default function TabLayout() {
  const accentColor = useOuterTheme().colors.tint;
  const theme = useAppTheme();
  const tablet = Platform.OS === 'ios' && Platform.isPad;

  return (
    <TabletNavigation>
      <NativeTabs
        backgroundColor="transparent"
        blurEffect="systemUltraThinMaterial"
        minimizeBehavior="onScrollDown"
        shadowColor="transparent"
        // Android's default is opaque primary; keep repeated native ripples translucent.
        rippleColor={Platform.OS === 'android' ? `${accentColor.slice(0, 7)}1A` : undefined}
      >
        <NativeTabs.Trigger
          name="(home)"
          contentStyle={{ backgroundColor: theme.colors.background }}
          disableAutomaticContentInsets={tablet || Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>首页</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="home"
            sf={{ default: 'house', selected: 'house.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(servers)" disableAutomaticContentInsets={tablet}>
          <NativeTabs.Trigger.Label>服务器</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="storage"
            sf={{ default: 'externaldrive', selected: 'externaldrive.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(favorites)">
          <NativeTabs.Trigger.Label>收藏</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="heart_outline"
            sf={{ default: 'heart', selected: 'heart.fill' }}
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
        <NativeTabs.Trigger name="(search)" role="search">
          <NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="search"
            sf="magnifyingglass"
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabletNavigation>
  );
}
