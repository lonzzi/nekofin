import { useTranslation } from '@/lib/i18n';
import { MEDIA_SERVER_TYPES } from '@/lib/mediaServerTypes';
import { layout, useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { ServerFormButton } from './ServerFormButton';
import { ServerFormField, ServerFormSection } from './ServerFormControls';
import { ServerFormScrollView } from './ServerFormScrollView';
import { ServerTypeIcon } from './ServerTypeIcon';

export type ServerFormValues = {
  address: string;
  username: string;
  password: string;
  name: string;
  note: string;
};

export type NativeServerFormProps = {
  values: ServerFormValues;
  onChange: (field: keyof ServerFormValues, value: string) => void;
  serverType: MediaServerType;
  connection: { address: string; name: string; version: string } | null;
  busy: boolean;
  error: string;
  onSubmit: () => void;
  onChangeServer?: () => void;
};

export function NativeServerForm({
  values,
  onChange,
  serverType,
  connection,
  busy,
  error,
  onSubmit,
  onChangeServer,
}: NativeServerFormProps) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const title = MEDIA_SERVER_TYPES[serverType].label;
  return (
    <ServerFormScrollView
      testID="add-media-account-form"
      maxContentWidth={layout.formMaxWidth}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.backgroundGrouped }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.intro}>
        <ServerTypeIcon type={serverType} size={56} />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          {connection
            ? tr('server.signInTo', { value: connection.name || title })
            : tr('server.connectTo', { title: title })}
        </Text>
        {connection ? (
          <Text selectable style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {`${connection.address}${connection.version ? tr('about.versionNote', { version: connection.version }) : ''}`}
          </Text>
        ) : null}
      </View>
      {connection ? (
        <ServerFormSection>
          <ServerFormField
            label={tr('server.username')}
            key="username"
            defaultValue={values.username}
            onChangeText={(text) => onChange('username', text)}
            autoComplete="username"
            editable={!busy}
          />
          <ServerFormField
            label={tr('server.password')}
            placeholder={tr('common.optional')}
            key="password"
            defaultValue={values.password}
            onChangeText={(text) => onChange('password', text)}
            password
            autoComplete="password"
            editable={!busy}
            onSubmitEditing={onSubmit}
          />
        </ServerFormSection>
      ) : (
        <ServerFormSection>
          <ServerFormField
            label={tr('server.url')}
            placeholder="https://media.example.com:8096"
            key="address"
            defaultValue={values.address}
            onChangeText={(text) => onChange('address', text)}
            keyboardType="url"
            autoComplete="url"
            editable={!busy}
            onSubmitEditing={onSubmit}
          />
        </ServerFormSection>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      ) : null}
      <ServerFormButton
        busy={busy}
        title={
          busy
            ? connection
              ? tr('server.signingIn')
              : tr('server.connecting')
            : connection
              ? tr('server.signInAndSave')
              : tr('server.connect')
        }
        disabled={busy || !(connection ? values.username.trim() : values.address.trim())}
        onPress={onSubmit}
      />
      {connection ? (
        <>
          {onChangeServer ? (
            <Button
              title={tr('server.changeServer')}
              color={theme.colors.tint}
              disabled={busy}
              onPress={onChangeServer}
            />
          ) : null}
          <Button
            title={expanded ? tr('server.hideDisplayOptions') : tr('server.optionalDisplayOptions')}
            color={theme.colors.textSecondary}
            disabled={busy}
            onPress={() => setExpanded((previous) => !previous)}
          />
          {expanded ? (
            <ServerFormSection>
              <ServerFormField
                label={tr('server.displayName')}
                placeholder={connection.name || title}
                key="name"
                defaultValue={values.name}
                onChangeText={(text) => onChange('name', text)}
                editable={!busy}
              />
              <ServerFormField
                label={tr('common.note')}
                placeholder={tr('common.optional')}
                key="note"
                defaultValue={values.note}
                onChangeText={(text) => onChange('note', text)}
                editable={!busy}
              />
            </ServerFormSection>
          ) : null}
        </>
      ) : null}
    </ServerFormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40, gap: 20 },
  intro: { gap: 14 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
});
