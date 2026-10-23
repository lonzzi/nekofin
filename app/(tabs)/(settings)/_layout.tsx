import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { useTranslation } from '@/lib/i18n';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';

function HomeLayout() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;
  const stackScreenListeners = usePerformanceStackScreenListeners('settings');

  const stackOptions = useNativeListStackOptions(backgroundColor);
  return (
    <Stack
      initialRouteName="index"
      screenListeners={stackScreenListeners}
      screenOptions={{
        ...stackOptions,
        headerTintColor: theme.colors.tint,
        headerTitleStyle: { color: theme.colors.text },
        headerLargeTitleStyle: { color: theme.colors.text },
      }}
    >
      <Stack.Screen name="playback" options={{ title: tr('settings.playbackAndQuality') }} />
      <Stack.Screen name="audio" options={{ title: tr('settings.audioAndSubtitles') }} />
      <Stack.Screen name="subtitle-fonts" options={{ title: tr('fonts.subtitleFonts') }} />
      <Stack.Screen name="subtitle-font-url" options={{ title: tr('fonts.importFromUrl') }} />
      <Stack.Screen name="about" options={{ title: tr('about.helpAndAbout') }} />
      <Stack.Screen
        name="index"
        options={{
          title: tr('navigation.settings'),
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="danmaku"
        options={{
          headerTitle: tr('danmaku.settings'),
        }}
      />
      <Stack.Screen name="danmaku-sources" options={{ title: tr('danmaku.apis') }} />
      <Stack.Screen name="danmaku-source/[id]" options={{ title: tr('danmaku.apis') }} />
      <Stack.Screen
        name="performance"
        options={{
          headerTitle: tr('diagnostics.performance'),
        }}
      />
      <Stack.Screen
        name="cache"
        options={{
          headerTitle: tr('settings.storage'),
        }}
      />
    </Stack>
  );
}

export default withOuterTheme(HomeLayout);
