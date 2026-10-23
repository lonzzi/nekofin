import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import {
  BottomSheet,
  Button,
  Host,
  NavigationStack,
  Toolbar,
  ToolbarItem,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  labelStyle,
  navigationBarTitleDisplayMode,
  navigationTitle,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  scrollEdgeEffectStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { usePlayerPanelPresentation, type PlayerPanelHostProps } from './playerPanelPresentation';

export function PlayerPanelHost(props: PlayerPanelHostProps) {
  const { t: tr } = useTranslation();
  const { visible, onDismiss, testID = 'player-panel-host' } = props;
  const theme = useAppTheme();
  const panel = usePlayerPanelPresentation(props);

  return (
    <Host style={{ position: 'absolute' }} pointerEvents="none" colorScheme={theme.colorScheme}>
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        testID={testID}
      >
        <NavigationStack
          modifiers={[
            presentationDetents(['large']),
            presentationDragIndicator('visible'),
            presentationBackground(theme.colors.backgroundGrouped),
            tint(theme.colors.tint),
          ]}
        >
          <Toolbar
            modifiers={[
              navigationTitle(panel.title),
              navigationBarTitleDisplayMode('inline'),
              scrollEdgeEffectStyle('soft', 'top'),
            ]}
          >
            {panel.children}
            <Toolbar.Content>
              {panel.onBack ? (
                <ToolbarItem placement="topBarLeading">
                  <Button
                    label={tr('common.back')}
                    systemImage="chevron.backward"
                    onPress={panel.onBack}
                    modifiers={[accessibilityLabel(tr('common.goBack'))]}
                  />
                </ToolbarItem>
              ) : null}
              <ToolbarItem placement="topBarTrailing">
                <Button
                  role="close"
                  label={tr('common.close')}
                  systemImage="xmark"
                  onPress={onDismiss}
                  modifiers={[
                    labelStyle('iconOnly'),
                    accessibilityLabel(tr('common.closeTitle', { title: panel.title })),
                  ]}
                />
              </ToolbarItem>
            </Toolbar.Content>
          </Toolbar>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}
