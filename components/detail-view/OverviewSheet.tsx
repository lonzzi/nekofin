import { spacing, useAppTheme } from '@/lib/theme';
import { BottomSheet, Button, Column, Row, ScrollView, Spacer, Text } from '@expo/ui';
import { onSizeChanged } from '@expo/ui/jetpack-compose/modifiers';
import {
  accessibilityAddTraits,
  buttonStyle,
  fixedSize,
  font,
  frame,
  onGeometryChange,
  tint,
  useScrollGeometryChange,
} from '@expo/ui/swift-ui/modifiers';
import { useCallback, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

function OverviewContent({ overview, onDismiss }: { overview: string; onDismiss: () => void }) {
  const theme = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);
  const maxHeight = windowHeight * 0.7;
  const measureContent = useCallback(({ height }: { height: number }) => {
    const nextHeight = Math.ceil(height);
    setContentHeight((previous) => (previous === nextHeight ? previous : nextHeight));
  }, []);
  const usesScrollGeometry = Platform.OS === 'ios' && Number(Platform.Version) >= 18;
  const scrollGeometry = useScrollGeometryChange(
    usesScrollGeometry
      ? (geometry) => measureContent({ height: geometry.contentHeight })
      : undefined,
  );

  return (
    <Column spacing={spacing.lg}>
      <Row alignment="center">
        <Text
          textStyle={{ fontSize: 20, fontWeight: '600', color: theme.colors.text }}
          modifiers={
            Platform.OS === 'ios'
              ? [
                  font({ textStyle: 'title3', weight: 'semibold' }),
                  accessibilityAddTraits(['isHeader']),
                ]
              : undefined
          }
        >
          剧情简介
        </Text>
        <Spacer flexible />
        <Button
          label="完成"
          variant="text"
          onPress={onDismiss}
          modifiers={
            Platform.OS === 'ios' ? [buttonStyle('borderless'), tint(theme.colors.tint)] : undefined
          }
        />
      </Row>
      <ScrollView
        style={{ height: Math.min(contentHeight || maxHeight, maxHeight) }}
        modifiers={Platform.OS === 'ios' && scrollGeometry ? [scrollGeometry] : undefined}
      >
        <Column
          modifiers={
            Platform.OS === 'ios' && !usesScrollGeometry
              ? [
                  frame({ maxWidth: Infinity, alignment: 'topLeading' }),
                  onGeometryChange(measureContent),
                ]
              : Platform.OS === 'android'
                ? [onSizeChanged(measureContent)]
                : undefined
          }
        >
          <Text
            textStyle={{ fontSize: 17, lineHeight: 24, color: theme.colors.text }}
            modifiers={
              Platform.OS === 'ios'
                ? [
                    font({ textStyle: 'body' }),
                    // Keep the native sheet's proposed width, but measure every wrapped line.
                    fixedSize({ horizontal: false, vertical: true }),
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                  ]
                : undefined
            }
          >
            {overview}
          </Text>
        </Column>
      </ScrollView>
    </Column>
  );
}

export function OverviewSheet({
  overview,
  isPresented,
  onDismiss,
}: {
  overview: string;
  isPresented: boolean;
  onDismiss: () => void;
}) {
  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      contentPadding={{
        top: spacing.xl,
        left: spacing.page,
        right: spacing.page,
        bottom: spacing.page,
      }}
      testID="item-overview-sheet"
    >
      <OverviewContent key={overview} overview={overview} onDismiss={onDismiss} />
    </BottomSheet>
  );
}
