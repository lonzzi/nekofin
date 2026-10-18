import { getServerMenuIcon } from '@/components/navigation/nativeToolbarIcons';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { MEDIA_SERVER_TYPE_OPTIONS } from '@/lib/mediaServerTypes';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { Icon } from '@expo/ui/jetpack-compose';
import { rotate } from '@expo/ui/jetpack-compose/modifiers';

export function ServerTypePicker({ onSelect }: { onSelect: (type: MediaServerType) => void }) {
  const theme = useAppTheme();
  return (
    <NativeSettingsForm testID="server-type-picker">
      <NativeSettingsSection title="添加第一个服务器">
        {MEDIA_SERVER_TYPE_OPTIONS.map(({ type, label }) => (
          <NativeSettingsItem
            key={type}
            title={label}
            leading={<Icon source={getServerMenuIcon(type)} size={36} tint={null} />}
            trailing={
              <Icon
                source={require('../../assets/drawables/chevron_left.png')}
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
