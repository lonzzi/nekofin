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
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { usePlayerPanelPresentation, type PlayerPanelHostProps } from './playerPanelPresentation';

export function PlayerPanelHost(props: PlayerPanelHostProps) {
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
            modifiers={[navigationTitle(panel.title), navigationBarTitleDisplayMode('inline')]}
          >
            {panel.children}
            <Toolbar.Content>
              {panel.onBack ? (
                <ToolbarItem placement="topBarLeading">
                  <Button
                    label="返回"
                    systemImage="chevron.backward"
                    onPress={panel.onBack}
                    modifiers={[accessibilityLabel('返回上一页')]}
                  />
                </ToolbarItem>
              ) : null}
              <ToolbarItem placement="topBarTrailing">
                <Button
                  role="close"
                  label="关闭"
                  systemImage="xmark"
                  onPress={onDismiss}
                  modifiers={[labelStyle('iconOnly'), accessibilityLabel('关闭' + panel.title)]}
                />
              </ToolbarItem>
            </Toolbar.Content>
          </Toolbar>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}
