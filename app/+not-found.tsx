import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useTranslation } from '@/lib/i18n';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const goToDestination = useAppNavigation();
  return (
    <>
      <Stack.Screen options={{ title: t('navigation.pageNotFound') }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">{t('navigation.pageNotFoundDescription')}</ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => goToDestination('home')}
          style={styles.link}
        >
          <ThemedText type="link">{t('navigation.goHome')}</ThemedText>
        </Pressable>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
