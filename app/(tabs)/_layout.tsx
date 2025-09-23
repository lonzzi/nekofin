import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { Icon, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { accentColor } = useAccentColor();

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index" hidden />
      <NativeTabs.Trigger
        name="(home)"
        options={{
          title: '首页',
        }}
      >
        {Platform.OS === 'android' ? (
          <Icon src={require('@/assets/icons/film.png')} selectedColor={accentColor} />
        ) : (
          <Icon sf={{ default: 'film', selected: 'film.fill' }} selectedColor={accentColor} />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(search)"
        options={{
          title: '搜索',
          role: 'search',
        }}
      >
        {Platform.OS === 'android' ? (
          <Icon src={require('@/assets/icons/search.png')} selectedColor={accentColor} />
        ) : (
          <Icon
            sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
            selectedColor={accentColor}
          />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(favorites)"
        options={{
          title: '收藏',
        }}
      >
        {Platform.OS === 'android' ? (
          <Icon src={require('@/assets/icons/heart.png')} selectedColor={accentColor} />
        ) : (
          <Icon sf={{ default: 'heart', selected: 'heart.fill' }} selectedColor={accentColor} />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(settings)"
        options={{
          title: '设置',
        }}
      >
        {Platform.OS === 'android' ? (
          <Icon src={require('@/assets/icons/settings.png')} selectedColor={accentColor} />
        ) : (
          <Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            selectedColor={accentColor}
          />
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
