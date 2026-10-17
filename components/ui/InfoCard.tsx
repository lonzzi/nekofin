import { layout, spacing, useAppTheme } from '@/lib/theme';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassCard } from './GlassCard';
import { SkeletonText } from './Skeleton';

type InfoRow = { label: string; value: string };

export function InfoCard({
  children,
  style,
  title,
  variant = 'summary',
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  title?: string;
  variant?: 'summary' | 'media';
}>) {
  const theme = useAppTheme();

  return (
    <GlassCard
      radius={theme.radius.lg}
      style={[
        styles.card,
        variant === 'media' ? styles.mediaCard : Platform.OS === 'ios' && styles.summaryCard,
        style,
      ]}
      surface="material"
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={[theme.typography.footnote, styles.title, { color: theme.colors.text }]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </GlassCard>
  );
}

export function InfoCardRows({ rows }: { rows: readonly InfoRow[] }) {
  const theme = useAppTheme();

  return rows.map((row) => (
    <View key={row.label} style={styles.row}>
      <Text
        style={[theme.typography.footnote, styles.label, { color: theme.colors.textSecondary }]}
      >
        {row.label}
      </Text>
      <Text style={[theme.typography.footnote, styles.value, { color: theme.colors.text }]}>
        {row.value}
      </Text>
    </View>
  ));
}

export function InfoCardPlaceholderRows({ count = 5 }: { count?: number }) {
  const theme = useAppTheme();
  return Array.from({ length: count }, (_, index) => (
    <View key={index} style={styles.row}>
      <View style={styles.label}>
        <SkeletonText width="80%" textStyle={theme.typography.footnote} />
      </View>
      <View style={styles.value}>
        <SkeletonText width={index % 2 ? '65%' : '90%'} textStyle={theme.typography.footnote} />
      </View>
    </View>
  ));
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    rowGap: spacing.sm,
  },
  summaryCard: {
    width: layout.mediaInfoCard.width,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  mediaCard: {
    width: layout.mediaInfoCard.width,
    minHeight: layout.mediaInfoCard.minHeight,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: spacing.sm,
  },
  label: {
    width: 56,
    flexShrink: 0,
  },
  value: {
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
});
