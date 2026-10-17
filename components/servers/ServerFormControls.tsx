import { useAppTheme } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export function ServerFormSection({ children, footer }: { children: ReactNode; footer?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>{children}</View>
      {footer ? (
        <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

export function ServerFormField({
  label,
  password,
  ...props
}: Omit<TextInputProps, 'value'> & { label: string; password?: boolean }) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  // Keep native typing/IME composition intact. Form steps key inputs by their field name.
  const initialValue = useRef(props.defaultValue ?? '');
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          selectionColor={theme.colors.tint}
          secureTextEntry={password && !visible}
          style={[styles.input, { color: theme.colors.text }]}
          {...props}
          defaultValue={initialValue.current}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? '隐藏密码' : '显示密码'}
            disabled={props.editable === false}
            hitSlop={8}
            onPress={() => setVisible((previous) => !previous)}
            style={styles.eye}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.tint}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 14, padding: 16, gap: 16 },
  footer: { fontSize: 13, lineHeight: 19, paddingHorizontal: 12 },
  field: { gap: 4 },
  label: { fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 40, padding: 0, fontSize: 17 },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
