import { useTranslation } from '@/lib/i18n';
import { MEDIA_SERVER_TYPES } from '@/lib/mediaServerTypes';
import { layout, useAppTheme } from '@/lib/theme';
import {
  Button,
  DisclosureGroup,
  Divider,
  Form,
  Grid,
  Host,
  HStack,
  LabeledContent,
  ProgressView,
  RNHostView,
  Section,
  SecureField,
  Text,
  TextField,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  controlSize,
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  gridCellUnsizedAxes,
  keyboardType,
  labelStyle,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  scrollContentBackground,
  scrollDismissesKeyboard,
  onSubmit as submitAction,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

import type { NativeServerFormProps, ServerFormValues } from './NativeServerForm';
import { ServerTypeIcon } from './ServerTypeIcon';

function Field({
  field,
  title,
  placeholder,
  values,
  onChange,
  onSubmit,
}: Pick<NativeServerFormProps, 'values' | 'onChange'> & {
  field: keyof ServerFormValues;
  title: string;
  placeholder: string;
  onSubmit?: () => void;
}) {
  const { t: tr } = useTranslation();
  const value = useNativeState(values[field]);
  const lastText = useRef(values[field]);
  const [visible, setVisible] = useState(false);
  const text = values[field];
  useEffect(() => {
    // Only write external changes back to native state, preserving typing and IME composition.
    if (lastText.current !== text) {
      lastText.current = text;
      value.set(text);
    }
  }, [value, text]);
  const modifiers: NonNullable<ComponentProps<typeof TextField>['modifiers']> = [
    accessibilityLabel(title),
    autocorrectionDisabled(true),
    textInputAutocapitalization('never'),
    ...(field === 'address' ? [keyboardType('url'), textContentType('URL')] : []),
    ...(field === 'username' ? [textContentType('username')] : []),
    ...(field === 'password' ? [textContentType('password')] : []),
    ...(onSubmit ? [submitLabel('go'), submitAction(onSubmit)] : []),
  ];
  const props = {
    text: value,
    placeholder,
    onTextChange: (text: string) => {
      lastText.current = text;
      onChange(field, text);
    },
    modifiers,
  };
  const input =
    field === 'password' ? (
      <HStack spacing={8}>
        {visible ? <TextField {...props} /> : <SecureField {...props} />}
        <Button
          label={visible ? tr('server.hidePassword') : tr('server.showPassword')}
          systemImage={visible ? 'eye.slash' : 'eye'}
          onPress={() => setVisible((previous) => !previous)}
          modifiers={[
            buttonStyle('borderless'),
            labelStyle('iconOnly'),
            accessibilityLabel(visible ? tr('server.hidePassword') : tr('server.showPassword')),
          ]}
        />
      </HStack>
    ) : (
      <TextField {...props} />
    );
  return field === 'address' ? (
    <LabeledContent label={title}>{input}</LabeledContent>
  ) : (
    <Grid.Row>
      <Text
        modifiers={[
          fixedSize({ horizontal: true, vertical: false }),
          frame({ minHeight: 44, alignment: 'leading' }),
        ]}
      >
        {title}
      </Text>
      {input}
    </Grid.Row>
  );
}

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
  const canSubmit = !busy && !!(connection ? values.username.trim() : values.address.trim());
  const submit = () => {
    if (canSubmit) onSubmit();
  };
  const shared = { values, onChange };
  return (
    <Host
      style={{
        flex: 1,
        width: '100%',
        maxWidth: layout.formMaxWidth,
        alignSelf: 'center',
        backgroundColor: theme.colors.backgroundGrouped,
      }}
      colorScheme={theme.colorScheme}
      seedColor={theme.colors.tint}
      useViewportSizeMeasurement
    >
      <Form
        testID="add-media-account-form"
        modifiers={[
          disabled(busy),
          scrollContentBackground('hidden'),
          scrollDismissesKeyboard('interactively'),
        ]}
      >
        <Section
          header={
            <VStack alignment="leading" spacing={14}>
              <RNHostView matchContents>
                <ServerTypeIcon type={serverType} size={56} />
              </RNHostView>
              <Text
                modifiers={[
                  font({ textStyle: 'title', weight: 'bold' }),
                  foregroundStyle(theme.colors.text),
                  accessibilityAddTraits(['isHeader']),
                ]}
              >
                {connection
                  ? tr('server.signInTo', { value: connection.name || title })
                  : tr('server.connectTo', { title: title })}
              </Text>
              {connection ? (
                <Text
                  modifiers={[
                    font({ textStyle: 'subheadline' }),
                    foregroundStyle(theme.colors.textSecondary),
                    textSelection(true),
                  ]}
                >
                  {`${connection.address}${connection.version ? tr('about.versionNote', { version: connection.version }) : ''}`}
                </Text>
              ) : null}
            </VStack>
          }
        >
          {connection ? (
            <Grid alignment="leading" horizontalSpacing={12} verticalSpacing={0}>
              <Field
                {...shared}
                key="username"
                field="username"
                title={tr('server.username')}
                placeholder={tr('common.required')}
              />
              <Divider modifiers={[gridCellUnsizedAxes('horizontal')]} />
              <Field
                {...shared}
                key="password"
                field="password"
                title={tr('server.password')}
                placeholder={tr('common.optional')}
                onSubmit={submit}
              />
            </Grid>
          ) : (
            <Field
              {...shared}
              key="address"
              field="address"
              title={tr('server.url')}
              placeholder="https://media.example.com:8096"
              onSubmit={submit}
            />
          )}
        </Section>
        <Section
          modifiers={[
            listRowBackground('transparent'),
            listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
            listRowSeparator('hidden'),
          ]}
        >
          {error ? <Text modifiers={[foregroundStyle(theme.colors.danger)]}>{error}</Text> : null}
          <Button
            onPress={submit}
            modifiers={[
              buttonStyle('borderedProminent'),
              controlSize('large'),
              disabled(!canSubmit),
            ]}
          >
            <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
              {busy ? <ProgressView modifiers={[controlSize('small')]} /> : null}
              <Text>
                {busy
                  ? connection
                    ? tr('server.signingIn')
                    : tr('server.connecting')
                  : connection
                    ? tr('server.signInAndSave')
                    : tr('server.connect')}
              </Text>
            </HStack>
          </Button>
          {connection && onChangeServer ? (
            <Button label={tr('server.changeServer')} onPress={onChangeServer} />
          ) : null}
        </Section>
        {connection ? (
          <Section>
            <DisclosureGroup
              label={tr('server.optionalDisplayOptions')}
              isExpanded={expanded}
              onIsExpandedChange={setExpanded}
            >
              <Grid alignment="leading" horizontalSpacing={12} verticalSpacing={0}>
                <Field
                  {...shared}
                  field="name"
                  title={tr('server.displayName')}
                  placeholder={connection.name || title}
                />
                <Divider modifiers={[gridCellUnsizedAxes('horizontal')]} />
                <Field
                  {...shared}
                  field="note"
                  title={tr('common.note')}
                  placeholder={tr('common.optional')}
                />
              </Grid>
            </DisclosureGroup>
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
