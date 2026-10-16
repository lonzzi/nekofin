import { FloatingTabBarInsetProvider } from '@/components/navigation/FloatingTabBarInset';
import { useAppTheme } from '@/lib/theme';
import { useOuterTheme } from '@/lib/theme/OuterTheme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

export default function TabLayout() {
  const accentColor = useOuterTheme().colors.tint;
  const theme = useAppTheme();

  return (
    <FloatingTabBarInsetProvider>
      <NativeTabs
        backgroundColor="transparent"
        blurEffect="systemUltraThinMaterial"
        minimizeBehavior="onScrollDown"
        shadowColor="transparent"
        iconColor={
          Platform.OS === 'android'
            ? { default: theme.colors.textSecondary, selected: accentColor }
            : undefined
        }
        labelStyle={
          Platform.OS === 'android'
            ? {
                default: { color: theme.colors.textSecondary, fontSize: 12 },
                selected: { color: accentColor, fontSize: 12, fontWeight: '700' },
              }
            : undefined
        }
        labelVisibilityMode={Platform.OS === 'android' ? 'labeled' : undefined}
        rippleColor={Platform.OS === 'android' ? 'transparent' : undefined}
      >
        <NativeTabs.Trigger
          name="(home)"
          contentStyle={{ backgroundColor: theme.colors.background }}
          disableAutomaticContentInsets={Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>首页</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="home"
            sf={{ default: 'house', selected: 'house.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="(servers)"
          disableAutomaticContentInsets={Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>服务器</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="storage"
            sf={{ default: 'externaldrive', selected: 'externaldrive.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="(favorites)"
          disableAutomaticContentInsets={Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>收藏</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="heart_outline"
            sf={{ default: 'heart', selected: 'heart.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="(settings)"
          disableAutomaticContentInsets={Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>设置</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="settings"
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="(search)"
          role="search"
          disableAutomaticContentInsets={Platform.OS === 'android'}
        >
          <NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            drawable="search"
            sf="magnifyingglass"
            selectedColor={accentColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </FloatingTabBarInsetProvider>
  );
}
