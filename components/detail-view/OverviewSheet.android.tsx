import { NativeBottomSheet } from '@/components/ui/NativeBottomSheet.android';
import { spacing, useAppTheme } from '@/lib/theme';
import { Column, Text } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

export function OverviewSheet({
  overview,
  isPresented,
  onDismiss,
}: {
  overview: string;
  isPresented: boolean;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  return (
    <NativeBottomSheet isPresented={isPresented} onDismiss={onDismiss} testID="item-overview-sheet">
      <Column
        verticalArrangement={{ spacedBy: spacing.md }}
        modifiers={[fillMaxSize(), padding(spacing.page, 0, spacing.page, spacing.page)]}
      >
        <Text color={theme.colors.text} style={{ typography: 'titleLarge', fontWeight: '600' }}>
          剧情简介
        </Text>
        <Column modifiers={[weight(1), fillMaxWidth(), verticalScroll()]}>
          <Text color={theme.colors.text} style={{ fontSize: 17, lineHeight: 24 }}>
            {overview}
          </Text>
        </Column>
      </Column>
    </NativeBottomSheet>
  );
}
