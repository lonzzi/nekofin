import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { Button, Text, View } from 'react-native';

import { DetailSummaryPlaceholder, DetailTitle } from './DetailSummary';

export function DetailRequestState({
  title,
  mode,
  isError,
  onRetry,
}: {
  title?: string;
  mode: 'series' | 'movie' | 'episode';
  isError: boolean;
  onRetry: () => void;
}) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();

  if (!isError) return <DetailSummaryPlaceholder title={title} mode={mode} />;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title ? <DetailTitle title={title} /> : null}
      <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
        <Text
          accessibilityRole="alert"
          style={[theme.typography.bodyEmphasized, { color: theme.colors.text }]}
        >
          {tr('media.detailsLoadFailed')}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {tr('search.checkNetworkAndRetry')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title={tr('common.retry')} onPress={onRetry} color={theme.colors.tint} />
        </View>
      </View>
    </View>
  );
}
