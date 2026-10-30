import { getServerMenuIcon } from '@/components/navigation/nativeToolbarIcons';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { useTranslation } from '@/lib/i18n';
import { MEDIA_SERVER_TYPE_OPTIONS } from '@/lib/mediaServerTypes';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { Icon, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, rotate } from '@expo/ui/jetpack-compose/modifiers';

export function ServerTypePicker({ onSelect }: { onSelect: (type: MediaServerType) => void }) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  return (
    <NativeSettingsForm testID="server-type-picker">
      <Text
        color={theme.colors.text}
        style={{ fontSize: 28, fontWeight: '700' }}
        modifiers={[fillMaxWidth(), padding(16, 20, 16, 20)]}
      >
        {tr('server.addFirstServer')}
      </Text>
      <NativeSettingsSection>
        {MEDIA_SERVER_TYPE_OPTIONS.map(({ type, label }) => (
          <NativeSettingsItem
            key={type}
            title={label}
            leading={<Icon source={getServerMenuIcon(type)} size={36} tint={null} />}
            trailing={
              <Icon
                source={require('../../assets/drawables/chevron_left.xml')}
                size={16}
                tint={theme.colors.textTertiary}
                modifiers={[rotate(180)]}
              />
            }
            onPress={() => onSelect(type)}
            testID={`connect-${type}`}
          />
        ))}
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
