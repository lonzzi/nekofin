import { layout, useAppTheme } from '@/lib/theme';
import {
  Button,
  DisclosureGroup,
  Form,
  Host,
  HStack,
  LabeledContent,
  Section,
  SecureField,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  disabled,
  foregroundStyle,
  keyboardType,
  labelStyle,
  scrollContentBackground,
  scrollDismissesKeyboard,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState, type ComponentProps } from 'react';

import type { NativeServerFormProps, ServerFormValues } from './NativeServerForm';

function Field({
  field,
  title,
  placeholder,
  values,
  onChange,
}: Pick<NativeServerFormProps, 'values' | 'onChange'> & {
  field: keyof ServerFormValues;
  title: string;
  placeholder: string;
}) {
  const value = useNativeState(values[field]);
  const [visible, setVisible] = useState(false);
  const text = values[field];
  useEffect(() => value.set(text), [value, text]);
  const modifiers: NonNullable<ComponentProps<typeof TextField>['modifiers']> = [
    accessibilityLabel(title),
    autocorrectionDisabled(true),
    textInputAutocapitalization('never'),
    ...(field === 'address' ? [keyboardType('url'), textContentType('URL')] : []),
    ...(field === 'port' ? [keyboardType('numeric')] : []),
    ...(field === 'username' ? [textContentType('username')] : []),
    ...(field === 'password' ? [textContentType('password')] : []),
  ];
  const props = {
    text: value,
    placeholder,
    onTextChange: (text: string) => onChange(field, text),
    modifiers,
  };
  return (
    <LabeledContent label={title}>
      {field === 'password' ? (
        <HStack spacing={8}>
          {visible ? <TextField {...props} /> : <SecureField {...props} />}
          <Button
            label={visible ? '隐藏密码' : '显示密码'}
            systemImage={visible ? 'eye.slash' : 'eye'}
            onPress={() => setVisible((previous) => !previous)}
            modifiers={[
              buttonStyle('borderless'),
              labelStyle('iconOnly'),
              accessibilityLabel(visible ? '隐藏密码' : '显示密码'),
            ]}
          />
        </HStack>
      ) : (
        <TextField {...props} />
      )}
    </LabeledContent>
  );
}

export function NativeServerForm({ values, onChange, busy, error }: NativeServerFormProps) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const shared = { values, onChange };
  return (
    <Host
      style={{ flex: 1, width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center' }}
      colorScheme={theme.colorScheme}
      seedColor={theme.colors.tint}
      useViewportSizeMeasurement
    >
      <Form
        modifiers={[
          disabled(busy),
          scrollContentBackground('hidden'),
          scrollDismissesKeyboard('interactively'),
        ]}
        testID="native-server-form"
      >
        <Section title="连接信息">
          {error ? <Text modifiers={[foregroundStyle(theme.colors.danger)]}>{error}</Text> : null}
          <Field {...shared} field="address" title="服务器地址" placeholder="https://example.com" />
          <Field {...shared} field="username" title="用户名" placeholder="必填" />
          <Field {...shared} field="password" title="密码" placeholder="可选" />
          <DisclosureGroup
            label="更多连接选项"
            isExpanded={expanded}
            onIsExpandedChange={setExpanded}
          >
            <Field {...shared} field="port" title="端口" placeholder="使用地址中的端口" />
            <Field {...shared} field="path" title="路径" placeholder="例如 /jellyfin" />
          </DisclosureGroup>
        </Section>
        <Section title="显示信息">
          <Field {...shared} field="name" title="名称" placeholder="可选" />
          <Field {...shared} field="note" title="备注" placeholder="可选" />
        </Section>
      </Form>
    </Host>
  );
}
