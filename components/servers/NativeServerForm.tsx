import { layout, useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

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
  onChangeServer: () => void;
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
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const title = serverType === 'emby' ? 'Emby' : 'Jellyfin';
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
          {connection ? `登录 ${connection.name || title}` : `连接到 ${title}`}
        </Text>
        <Text selectable style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {connection
            ? `${connection.address}${connection.version ? `\n版本 ${connection.version}` : ''}`
            : '输入服务器地址，连接后登录你的账号。'}
        </Text>
      </View>
      {connection ? (
        <ServerFormSection>
          <ServerFormField
            label="用户名"
            key="username"
            defaultValue={values.username}
            onChangeText={(text) => onChange('username', text)}
            autoComplete="username"
            editable={!busy}
          />
          <ServerFormField
            label="密码"
            placeholder="可选"
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
        <ServerFormSection footer="填写完整地址，可包含端口和路径，例如 https://media.example.com/jellyfin。">
          <ServerFormField
            label="服务器地址"
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
      {busy ? <ActivityIndicator color={theme.colors.tint} /> : null}
      <ServerFormButton
        title={
          busy ? (connection ? '正在登录…' : '正在连接…') : connection ? '登录并保存' : '连接服务器'
        }
        disabled={busy || !(connection ? values.username.trim() : values.address.trim())}
        onPress={onSubmit}
      />
      {connection ? (
        <>
          <Button
            title="更换服务器"
            color={theme.colors.tint}
            disabled={busy}
            onPress={onChangeServer}
          />
          <Button
            title={expanded ? '收起显示选项' : '显示选项（可选）'}
            color={theme.colors.textSecondary}
            disabled={busy}
            onPress={() => setExpanded((previous) => !previous)}
          />
          {expanded ? (
            <ServerFormSection footer="留空时使用服务器名称。同一服务器的其他地址可在保存后添加为线路。">
              <ServerFormField
                label="显示名称"
                placeholder={connection.name || title}
                key="name"
                defaultValue={values.name}
                onChangeText={(text) => onChange('name', text)}
                editable={!busy}
              />
              <ServerFormField
                label="备注"
                placeholder="可选"
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
  intro: { gap: 14, paddingBottom: 12 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
});
