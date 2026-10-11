import { useAppTheme } from '@/lib/theme';
import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, StyleSheet, Text, View } from 'react-native';

const icons = {
  search: { systemImage: 'magnifyingglass', fallback: 'search' },
  favorites: { systemImage: 'heart', fallback: 'favorite-border' },
  media: { systemImage: 'film', fallback: 'movie' },
  server: { systemImage: 'server.rack', fallback: 'dns' },
} as const;

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: keyof typeof icons;
};

export function EmptyState({ title, description, icon = 'media' }: EmptyStateProps) {
  const theme = useAppTheme();

  if (Platform.OS === 'ios' && Number(Platform.Version) >= 17) {
    return (
      <Host style={styles.container} colorScheme={theme.colorScheme} ignoreSafeArea="all">
        <ContentUnavailableView
          key={`${icon}:${title}:${description ?? ''}`}
          title={title}
          description={description}
          systemImage={icons[icon].systemImage}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
        />
      </Host>
    );
  }

  return (
    <View style={[styles.container, styles.fallback]}>
      <MaterialIcons name={icons[icon].fallback} size={48} color={theme.colors.textSecondary} />
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 160, width: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
