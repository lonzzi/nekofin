import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { BottomSheet, Button, Column, Text as NativeText, Row, Spacer } from '@expo/ui';

import { usePlayerPanelPresentation, type PlayerPanelHostProps } from './playerPanelPresentation';

export type { PlayerPanelHostProps } from './playerPanelPresentation';

/** Fallback for platforms without the iOS / Android native presentation. */
export function PlayerPanelHost(props: PlayerPanelHostProps) {
  const { t: tr } = useTranslation();
  const { visible, onDismiss, testID = 'player-panel-host' } = props;
  const theme = useAppTheme();
  const panel = usePlayerPanelPresentation(props);
  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onDismiss}
      showDragIndicator
      snapPoints={['full']}
      testID={testID}
    >
      <Column spacing={10}>
        <Row spacing={8} alignment="center">
          {panel.onBack ? (
            <Button label={tr('common.back')} onPress={panel.onBack} variant="text" />
          ) : null}
          <NativeText textStyle={{ color: theme.colors.text }}>{panel.title}</NativeText>
          <Spacer flexible />
          <Button label={tr('common.close')} onPress={onDismiss} variant="text" />
        </Row>
        {panel.children}
      </Column>
    </BottomSheet>
  );
}
