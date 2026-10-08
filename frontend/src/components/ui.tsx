import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { ArrowUpRight, X, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { en } from '../i18n/en';
import { BrandMark } from './Brand';

export function Label({
  style,
  weight = 'regular',
  ...props
}: TextProps & { weight?: keyof typeof fonts }) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: fonts[weight], color: colors.text, fontSize: 14, lineHeight: 21 },
        style,
      ]}
    />
  );
}
export function Card({
  children,
  style,
  testID,
}: React.PropsWithChildren<{ style?: ViewStyle; testID?: string }>) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}
export function Chip({
  children,
  tone = 'green',
  dot = false,
}: React.PropsWithChildren<{
  tone?: 'green' | 'amber' | 'muted' | 'blue' | 'red';
  dot?: boolean;
}>) {
  const toneColors = {
    green: [colors.greenSoft, colors.green],
    amber: [colors.amberSoft, colors.amber],
    muted: ['#EEF0EE', colors.muted],
    blue: [colors.blueSoft, colors.blue],
    red: [colors.redSoft, colors.red],
  };
  const [backgroundColor, color] = toneColors[tone];
  return (
    <View style={[styles.chip, { backgroundColor }]}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: color }} />}
      <Label
        weight="bold"
        style={{
          fontSize: 10,
          lineHeight: 16,
          color,
          letterSpacing: 0.35,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Label>
    </View>
  );
}
export function Button({
  children,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  compact,
  testID,
}: React.PropsWithChildren<{
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
}>) {
  const foreground =
    variant === 'primary'
      ? '#fff'
      : variant === 'danger'
        ? colors.red
        : variant === 'ghost'
          ? colors.text
          : colors.green;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && { width: 'auto', minHeight: 44, paddingHorizontal: 13, alignSelf: 'flex-start' },
        variant === 'primary' && { backgroundColor: colors.green },
        variant === 'secondary' && {
          backgroundColor: colors.surface,
          borderColor: '#BDCBBF',
        },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'danger' && { backgroundColor: colors.redSoft, borderColor: '#F2C9C4' },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        pressed && !disabled && { transform: [{ translateY: -1 }] },
      ]}
    >
      <Label
        weight="bold"
        style={{ color: foreground, fontSize: compact ? 12 : 13, flexShrink: 1 }}
      >
        {children}
      </Label>
      {Icon && <Icon size={16} color={foreground} strokeWidth={1.8} />}
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.greenSoft }]}
    >
      <Icon size={20} color={colors.green} strokeWidth={1.7} />
    </Pressable>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flex: 1 }}>
        <Label weight="bold" style={{ fontSize: 18, lineHeight: 25, color: colors.ink }}>
          {title}
        </Label>
        {subtitle && (
          <Label style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{subtitle}</Label>
        )}
      </View>
      {action && onAction && (
        <Button compact variant="ghost" icon={ArrowUpRight} onPress={onAction}>
          {action}
        </Button>
      )}
    </View>
  );
}
export function Sheet({
  visible,
  title,
  children,
  onClose,
}: React.PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: '#173E2E77',
          justifyContent: width < 600 ? 'flex-end' : 'center',
          alignItems: 'center',
          padding: width < 600 ? 0 : 24,
        }}
      >
        <Pressable
          accessibilityLabel={en.close}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 570,
            maxHeight: '90%',
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 24,
            paddingBottom: Math.max(insets.bottom + 16, 24),
          }}
        >
          <View style={[styles.sectionTitle, { marginBottom: 20 }]}>
            <BrandMark size={34} />
            <Label
              accessibilityRole="header"
              weight="bold"
              style={{ flex: 1, fontSize: 22, lineHeight: 28 }}
            >
              {title}
            </Label>
            <IconButton icon={X} label={en.close} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Choice<T extends string>({
  values,
  selected,
  labels,
  onSelect,
  testPrefix,
}: {
  values: readonly T[];
  selected: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
  testPrefix?: string;
}) {
  return (
    <View style={styles.choices}>
      {values.map((value) => (
        <Pressable
          key={value}
          testID={testPrefix ? `${testPrefix}-${value}` : undefined}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === value }}
          onPress={() => onSelect(value)}
          style={[styles.choice, selected === value && { backgroundColor: colors.green }]}
        >
          <Label
            weight={selected === value ? 'bold' : 'medium'}
            style={{ color: selected === value ? '#fff' : colors.muted, fontSize: 12 }}
          >
            {labels[value]}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 17,
    shadowColor: '#192D20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 7,
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  button: {
    width: '100%',
    maxWidth: '100%',
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    backgroundColor: '#EFF2EB',
    padding: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  choice: {
    minHeight: 44,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
});
