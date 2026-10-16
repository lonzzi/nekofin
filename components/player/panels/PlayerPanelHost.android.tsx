import { NativeBottomSheet } from '@/components/ui/NativeBottomSheet.android';
import { useAppTheme } from '@/lib/theme';
import { Column, Icon, IconButton, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';

import { usePlayerPanelPresentation, type PlayerPanelHostProps } from './playerPanelPresentation';

export function PlayerPanelHost(props: PlayerPanelHostProps) {
  const { visible, onDismiss, testID = 'player-panel-host' } = props;
  const theme = useAppTheme();
  const panel = usePlayerPanelPresentation(props);

  return (
    <NativeBottomSheet
      isPresented={visible}
      onDismiss={onDismiss}
      skipPartiallyExpanded
      containerColor={theme.colors.backgroundGrouped}
      testID={testID}
    >
      <Column modifiers={[fillMaxSize()]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 0, 8, 8)]}>
          {panel.onBack ? (
            <IconButton onClick={panel.onBack}>
              <Icon
                source={require('../../../assets/drawables/chevron_left.png')}
                size={24}
                tint={theme.colors.text}
                contentDescription="返回上一页"
              />
            </IconButton>
          ) : null}
          <Text
            color={theme.colors.text}
            style={{ typography: 'titleLarge' }}
            modifiers={[weight(1)]}
          >
            {panel.title}
          </Text>
          <IconButton onClick={onDismiss}>
            <Icon
              source={require('../../../assets/drawables/close.png')}
              size={24}
              tint={theme.colors.text}
              contentDescription={'关闭' + panel.title}
            />
          </IconButton>
        </Row>
        {panel.children}
      </Column>
    </NativeBottomSheet>
  );
}
