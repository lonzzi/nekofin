import { spacing, useAppTheme } from '@/lib/theme';
import { BottomSheet, Host, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

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
    <Host style={{ position: 'absolute' }} pointerEvents="none" colorScheme={theme.colorScheme}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        testID="item-overview-sheet"
      >
        <VStack
          alignment="leading"
          spacing={spacing.md}
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
            padding({
              top: spacing.lg,
              leading: spacing.page,
              trailing: spacing.page,
              bottom: spacing.page,
            }),
            presentationDetents(['medium', 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          <Text
            modifiers={[
              font({ textStyle: 'title3', weight: 'semibold' }),
              foregroundStyle(theme.colors.text),
              accessibilityAddTraits(['isHeader']),
            ]}
          >
            剧情简介
          </Text>
          <ScrollView>
            <Text
              modifiers={[
                font({ textStyle: 'body' }),
                foregroundStyle(theme.colors.text),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              {overview}
            </Text>
          </ScrollView>
        </VStack>
      </BottomSheet>
    </Host>
  );
}
