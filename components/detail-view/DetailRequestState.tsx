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
          详情加载失败
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          请检查网络连接后重试
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="重试" onPress={onRetry} color={theme.colors.tint} />
        </View>
      </View>
    </View>
  );
}
