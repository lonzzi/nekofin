import { NativeSettingsForm, NativeSettingsItem } from '@/components/ui/NativeSettings';
import { useTranslation } from '@/lib/i18n';
import { MEDIA_SERVER_TYPE_OPTIONS } from '@/lib/mediaServerTypes';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { Column, FieldGroup, Text } from '@expo/ui';

import { ServerTypeIcon } from './ServerTypeIcon';

export function ServerTypePicker({ onSelect }: { onSelect: (type: MediaServerType) => void }) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  return (
    <NativeSettingsForm testID="server-type-picker">
      <FieldGroup.Section>
        <FieldGroup.SectionHeader>
          <Column style={{ paddingTop: 20, paddingBottom: 20 }}>
            <Text textStyle={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>
              {tr('server.addFirstServer')}
            </Text>
          </Column>
        </FieldGroup.SectionHeader>
        {MEDIA_SERVER_TYPE_OPTIONS.map(({ type, label }) => (
          <NativeSettingsItem
            key={type}
            title={label}
            leading={<ServerTypeIcon type={type} size={36} />}
            disclosure
            onPress={() => onSelect(type)}
            testID={`connect-${type}`}
          />
        ))}
      </FieldGroup.Section>
    </NativeSettingsForm>
  );
}
