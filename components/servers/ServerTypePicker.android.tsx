import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { MEDIA_SERVER_TYPE_OPTIONS } from '@/lib/mediaServerTypes';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { RNHostView, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { ServerTypeIcon } from './ServerTypeIcon';

export function ServerTypePicker({ onSelect }: { onSelect: (type: MediaServerType) => void }) {
  const theme = useAppTheme();
  return (
    <NativeSettingsForm testID="server-type-picker">
      <Text
        color={theme.colors.text}
        style={{ fontSize: 28, fontWeight: '700' }}
        modifiers={[fillMaxWidth(), padding(16, 20, 16, 20)]}
      >
        添加第一个服务器
      </Text>
      <NativeSettingsSection>
        {MEDIA_SERVER_TYPE_OPTIONS.map(({ type, label }) => (
          <NativeSettingsItem
            key={type}
            title={label}
            leading={
              <RNHostView matchContents>
                <ServerTypeIcon type={type} size={36} />
              </RNHostView>
            }
            trailing={
              <RNHostView matchContents>
                <IconSymbol name="chevron.right" size={20} color={theme.colors.textTertiary} />
              </RNHostView>
            }
            onPress={() => onSelect(type)}
            testID={`connect-${type}`}
          />
        ))}
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
