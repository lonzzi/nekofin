import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { TabletChromeContext } from '@/components/navigation/TabletChromeContext';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';

export default function SearchRootLayout() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const chrome = useContext(TabletChromeContext);
  const stackOptions = useNativeListStackOptions(theme.colors.background);

  // Only the native search toolbar needs space below the floating tablet tabs.
  // The parent stack stays full height while pushing and popping detail screens.
  return (
    <View style={{ flex: 1, paddingTop: chrome?.toolbarHeight ?? 0 }}>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="index" options={{ title: tr('search.title') }} />
      </Stack>
    </View>
  );
}
