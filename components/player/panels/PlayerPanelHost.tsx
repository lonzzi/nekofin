import { useAppTheme } from '@/lib/theme';
import { BottomSheet, Button, Column, Text as NativeText, Row, Spacer } from '@expo/ui';
import { fillMaxHeight, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type PlayerPanelHostProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onDismiss: () => void;
  onBack?: () => void;
  testID?: string;
};

type PanelPresentation = Pick<PlayerPanelHostProps, 'children' | 'onBack' | 'subtitle' | 'title'>;

/**
 * A fully native player sheet. @expo/ui maps this to SwiftUI Sheet on iOS and
 * Material 3 ModalBottomSheet on Android; its header and every panel body are
 * native nodes as well, so no JS drawer or hand-built modal chrome is involved.
 */
export function PlayerPanelHost({
  visible,
  title,
  subtitle,
  children,
  onDismiss,
  onBack,
  testID = 'player-panel-host',
}: PlayerPanelHostProps) {
  const theme = useAppTheme();
  const lastPresentationRef = useRef<PanelPresentation>({
    children,
    onBack,
    subtitle,
    title,
  });

  useEffect(() => {
    if (visible) lastPresentationRef.current = { children, onBack, subtitle, title };
  }, [children, onBack, subtitle, title, visible]);

  const presentation = visible
    ? { children, onBack, subtitle, title }
    : lastPresentationRef.current;
  const fillModifiers =
    Platform.OS === 'ios'
      ? [frame({ maxHeight: Infinity, maxWidth: Infinity, alignment: 'topLeading' })]
      : [fillMaxWidth(), fillMaxHeight()];
  const rowModifiers =
    Platform.OS === 'ios'
      ? [frame({ maxWidth: Infinity, alignment: 'leading' })]
      : [fillMaxWidth()];

  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onDismiss}
      showDragIndicator
      snapPoints={['full']}
      testID={testID}
    >
      <Column modifiers={fillModifiers} spacing={10}>
        <Row alignment="center" modifiers={rowModifiers} spacing={8}>
          {presentation.onBack ? (
            <Button label="返回" onPress={presentation.onBack} variant="text" />
          ) : null}
          <Column spacing={1}>
            <NativeText
              numberOfLines={1}
              textStyle={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}
            >
              {presentation.title}
            </NativeText>
            {presentation.subtitle ? (
              <NativeText
                numberOfLines={1}
                textStyle={{
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  fontWeight: '500',
                }}
              >
                {presentation.subtitle}
              </NativeText>
            ) : null}
          </Column>
          <Spacer flexible />
          <Button label="完成" onPress={onDismiss} variant="text" />
        </Row>
        {presentation.children}
      </Column>
    </BottomSheet>
  );
}
