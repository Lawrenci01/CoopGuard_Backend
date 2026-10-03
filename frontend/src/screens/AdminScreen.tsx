import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Building2, LogOut, QrCode, Share2, UserRoundPlus } from 'lucide-react-native';
import { Button, Card, Chip, Label } from '../components/ui';
import type { AdminFarmInput, AdminFarmResult } from '../services/apiTypes';
import { api } from '../services/api';
import { useAuth } from '../state/AuthProvider';
import { colors, fonts } from '../theme';

const emptyForm = (): AdminFarmInput => ({
  farmName: '',
  customerName: '',
  contactName: '',
  contactPhone: '',
  address: '',
  ownerUsername: '',
  ownerName: '',
});

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label weight="medium">{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 13,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: colors.ink,
          backgroundColor: colors.surface,
        }}
      />
    </View>
  );
}

export function AdminScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(emptyForm);
  const [created, setCreated] = useState<AdminFarmResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof AdminFarmInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const required: (keyof AdminFarmInput)[] = [
    'farmName',
    'customerName',
    'contactName',
    'contactPhone',
    'address',
    'ownerUsername',
    'ownerName',
  ];
  const canCreate = auth.online && required.every((key) => form[key].trim()) && !busy;

  const createFarm = async () => {
    if (!auth.record) return;
    const details = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()]),
    ) as AdminFarmInput;
    setBusy(true);
    setError('');
    try {
      const result = await api.adminCreateFarm(auth.server, auth.record.session.token, details);
      setCreated(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not create this farm.',
      );
      await auth.rejected(requestError);
    } finally {
      setBusy(false);
    }
  };

  const shareCredentials = async () => {
    if (!created) return;
    try {
      await Share.share({
        title: `CoopGuard setup · ${created.farmCode}`,
        message: [
          `Farm: ${created.farmCode}`,
          `Farm record: ${created.farmId}`,
          `Owner: ${created.owner.name}`,
          `Username: ${created.owner.username}`,
          `Temporary password: ${created.owner.password}`,
        ].join('\n'),
      });
    } catch {
      setError('Could not open sharing. The credentials are still shown here.');
    }
  };

  const startAnother = () => {
    setCreated(null);
    setForm(emptyForm());
    setError('');
  };

  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 14, paddingVertical: 18, borderTopWidth: 1, borderColor: colors.border }}>
      <Label weight="bold" style={{ color: colors.ink, fontSize: 16 }}>
        {title}
      </Label>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28, flexGrow: 1 }}
      >
        <View
          testID="admin-workspace"
          style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              paddingBottom: 22,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
              <Building2 size={25} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Label weight="bold" style={{ color: colors.ink, fontSize: 16 }}>
                  Team administration
                </Label>
                <Label style={{ color: colors.muted, fontSize: 12 }}>
                  {auth.record?.session.account.username}
                </Label>
              </View>
            </View>
            <Button compact variant="ghost" icon={LogOut} onPress={() => void auth.logout()}>
              Sign out
            </Button>
          </View>

          {created ? (
            <View testID="admin-farm-created" style={{ gap: 18 }}>
              <View style={{ gap: 7 }}>
                <Chip tone="green">FARM CREATED</Chip>
                <Label
                  accessibilityRole="header"
                  weight="bold"
                  style={{ color: colors.ink, fontSize: 25 }}
                >
                  {created.farmCode}
                </Label>
                <Label style={{ color: colors.muted }}>Farm record ID · {created.farmId}</Label>
              </View>
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 14 }}>
                <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 10 }}>
                  <QRCode value={created.qr} size={190} color={colors.ink} backgroundColor="#fff" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <QrCode size={17} color={colors.green} />
                  <Label weight="medium">Farm setup QR</Label>
                </View>
              </View>
              <Label style={{ color: colors.muted }}>
                Temporary passwords are shown once. Deliver each one privately; the account holder
                will set a new password at first sign-in.
              </Label>
              <Card style={{ gap: 8 }}>
                <Label weight="bold" style={{ color: colors.ink }}>
                  Owner account
                </Label>
                <Label>
                  {created.owner.name} · {created.owner.username}
                </Label>
                <Label weight="medium">Temporary password · {created.owner.password}</Label>
              </Card>
              {!!error && (
                <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
                  {error}
                </Label>
              )}
              <Button variant="secondary" icon={Share2} onPress={() => void shareCredentials()}>
                Share setup credentials
              </Button>
              <Button icon={Building2} onPress={startAnother}>
                Create another farm
              </Button>
            </View>
          ) : (
            <View style={{ gap: 18 }}>
              <View style={{ gap: 8, paddingBottom: 3 }}>
                <Chip tone={auth.online ? 'green' : 'amber'} dot>
                  {auth.online
                    ? auth.activeConnection === 'hub'
                      ? 'FARM HUB CONNECTED'
                      : 'CLOUD CONNECTED'
                    : 'SERVER UNAVAILABLE'}
                </Chip>
                <Label
                  accessibilityRole="header"
                  weight="bold"
                  style={{ color: colors.ink, fontSize: 25 }}
                >
                  Register a farm
                </Label>
                <Label style={{ color: colors.muted }}>
                  Create the farm and its owner account. The shared technician can select it after
                  registration.
                </Label>
              </View>

              {section(
                'Farm and customer',
                <>
                  <Field
                    label="Farm name"
                    value={form.farmName}
                    onChange={(value) => update('farmName', value)}
                  />
                  <Field
                    label="Customer name"
                    value={form.customerName}
                    onChange={(value) => update('customerName', value)}
                  />
                  <Field
                    label="Contact person"
                    value={form.contactName}
                    onChange={(value) => update('contactName', value)}
                  />
                  <Field
                    label="Contact number"
                    value={form.contactPhone}
                    onChange={(value) => update('contactPhone', value)}
                    keyboardType="phone-pad"
                  />
                  <Field
                    label="Farm address"
                    value={form.address}
                    onChange={(value) => update('address', value)}
                    autoCapitalize="sentences"
                  />
                </>,
              )}

              {section(
                'Farm owner',
                <>
                  <Field
                    label="Owner full name"
                    value={form.ownerName}
                    onChange={(value) => update('ownerName', value)}
                  />
                  <Field
                    label="Owner username"
                    value={form.ownerUsername}
                    onChange={(value) => update('ownerUsername', value)}
                    autoCapitalize="none"
                  />
                </>,
              )}

              {!!error && (
                <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
                  {error}
                </Label>
              )}
              {!auth.online && (
                <Label style={{ color: colors.amber }}>
                  Connect to the cloud or a commissioned farm hub to register a farm.
                </Label>
              )}
              <Button
                testID="admin-create-farm"
                icon={UserRoundPlus}
                disabled={!canCreate}
                onPress={() => void createFarm()}
              >
                {busy ? 'Creating farm…' : 'Create farm and owner account'}
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
