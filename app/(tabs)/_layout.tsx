import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { isGreaterThanOrEqual26 } from '@/lib/utils';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  const { accentColor } = useAccentColor();

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index" hidden />
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>媒体库</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="film"
          sf={{ default: 'film', selected: 'film.fill' }}
          selectedColor={accentColor}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role={isGreaterThanOrEqual26 ? 'search' : undefined}>
        <NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="search"
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          selectedColor={accentColor}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(favorites)">
        <NativeTabs.Trigger.Label>收藏</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          drawable="heart"
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
    </NativeTabs>
  );
}
