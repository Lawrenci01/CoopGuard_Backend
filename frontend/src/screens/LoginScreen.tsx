import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Cloud,
  Eye,
  EyeOff,
  Laptop,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Usb,
  Wifi,
} from 'lucide-react-native';
import { useAuth } from '../state/AuthProvider';
import { Button, Label } from '../components/ui';
import { BrandLockup, FieldGuideArtwork } from '../components/Brand';
import { colors, fonts } from '../theme';
import { QrScannerScreen } from '../components/QrScannerScreen';
import { hubServerFromQr } from '../domain/hubPairing';
import { api } from '../services/api';
import { connectToHubHotspot } from '../services/hubWifi';

export function AuthField({
  label,
  value,
  onChange,
  secret = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Label weight="bold" style={{ color: '#4F5952', fontSize: 12 }}>
        {label}
      </Label>
      <View
        style={{
          minHeight: 52,
          borderWidth: 1,
          borderColor: '#D5DBD6',
          borderRadius: 13,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secret && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={secret ? 128 : 200}
          style={{
            minHeight: 50,
            flex: 1,
            paddingHorizontal: 14,
            fontFamily: fonts.regular,
            fontSize: 15,
            color: colors.ink,
          }}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            onPress={() => setVisible((current) => !current)}
            style={{ width: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}
          >
            {visible ? (
              <EyeOff size={19} color={colors.muted} strokeWidth={1.8} />
            ) : (
              <Eye size={19} color={colors.muted} strokeWidth={1.8} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <View style={{ gap: 16 }}>
      <Label>Choose your own password. Use at least 12 characters.</Label>
      <AuthField label="Current password" value={current} onChange={setCurrent} secret />
      <AuthField label="New password" value={next} onChange={setNext} secret />
      <AuthField label="Confirm new password" value={confirm} onChange={setConfirm} secret />
      {!!error && (
        <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
          {error}
        </Label>
      )}
      <Button
        testID="change-password"
        disabled={busy}
        onPress={async () => {
          if (next.length < 12 || next !== confirm) {
            setError('Use at least 12 characters and enter the same new password twice.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await auth.changePassword(current, next);
            setCurrent('');
            setNext('');
            setConfirm('');
            onDone?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not change the password.');
            await auth.rejected(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : 'Save password'}
      </Button>
    </View>
  );
}
export function LoginScreen() {
  const auth = useAuth(),
    insets = useSafeAreaInsets();
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [connection, setConnection] = useState<'cloud' | 'hub'>('cloud');
  const [hubServer, setHubServer] = useState('https://localhost:8443');
  const [hubTransport, setHubTransport] = useState<'wifi' | 'usb'>('wifi');
  const [scanHub, setScanHub] = useState(false);
  const [scannedHubId, setScannedHubId] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const changing = !!auth.record?.session.account.mustChangePassword;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#E8EBE7' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 480,
            minHeight: '100%',
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              minHeight: 342,
              backgroundColor: colors.greenDark,
              borderBottomLeftRadius: 32,
              borderBottomRightRadius: 32,
              paddingTop: insets.top + 28,
              paddingHorizontal: 26,
              paddingBottom: 38,
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 230,
                height: 230,
                borderRadius: 115,
                backgroundColor: '#7FA98A17',
                right: -95,
                top: 22,
              }}
            />
            <BrandLockup inverse markSize={58} />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: -16,
                top: insets.top + 70,
                zIndex: 1,
              }}
            >
              <FieldGuideArtwork width={148} />
            </View>
            <View style={{ marginTop: 46, maxWidth: 230, zIndex: 2 }}>
              <Label
                weight="bold"
                style={{ color: '#FFFFFF', fontSize: 31, lineHeight: 37, letterSpacing: -1.1 }}
              >
                {changing ? 'Secure your account.' : 'Hear the threat.\nSave the flock.'}
              </Label>
              <Label style={{ color: '#FFFFFFA6', marginTop: 12, maxWidth: 225 }}>
                {changing
                  ? 'Set a private password before opening your farm.'
                  : 'Local-first environmental monitoring for modern poultry farms.'}
              </Label>
            </View>
          </View>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 27,
              paddingBottom: insets.bottom + 32,
              gap: 18,
            }}
          >
            <View style={{ gap: 4 }}>
              <Label weight="bold" style={{ fontSize: 21, lineHeight: 28 }}>
                {changing ? 'Set your password' : 'Welcome back'}
              </Label>
              <Label style={{ color: colors.muted }}>
                {changing
                  ? 'Your temporary password must be changed before opening the farm.'
                  : 'Sign in to your CoopGuard account'}
              </Label>
            </View>
            {changing ? (
              <PasswordForm />
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Label weight="bold" style={{ color: '#4F5952', fontSize: 12 }}>
                    Sign in through
                  </Label>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      compact
                      icon={Cloud}
                      variant={connection === 'cloud' ? 'primary' : 'secondary'}
                      onPress={() => setConnection('cloud')}
                    >
                      Cloud
                    </Button>
                    <Button
                      compact
                      icon={Laptop}
                      variant={connection === 'hub' ? 'primary' : 'secondary'}
                      onPress={() => setConnection('hub')}
                    >
                      Laptop hub
                    </Button>
                  </View>
                </View>
                {connection === 'hub' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button
                        compact
                        icon={Wifi}
                        variant={hubTransport === 'wifi' ? 'primary' : 'secondary'}
                        onPress={() => {
                          setHubTransport('wifi');
                          setScannedHubId('');
                        }}
                      >
                        Hub WiFi
                      </Button>
                      <Button
                        compact
                        icon={Usb}
                        variant={hubTransport === 'usb' ? 'primary' : 'secondary'}
                        onPress={() => {
                          setHubTransport('usb');
                          setScannedHubId('');
                        }}
                      >
                        USB cable
                      </Button>
                    </View>
                    <Button icon={QrCode} onPress={() => setScanHub(true)}>
                      Scan laptop hub QR
                    </Button>
                    <QrScannerScreen
                      visible={scanHub}
                      title="Connect to Laptop Hub"
                      instruction={`Scan the QR shown on the laptop. This phone will use ${hubTransport === 'wifi' ? 'the CoopGuard hub WiFi' : 'the USB cable'}.`}
                      onClose={() => setScanHub(false)}
                      onScanned={async (data) => {
                        setScanHub(false);
                        setError('');
                        try {
                          const selected = hubServerFromQr(data, hubTransport);
                          if (hubTransport === 'wifi')
                            await connectToHubHotspot(selected.qr);
                          const health = await api.health(selected.server);
                          if (
                            health.service !== 'CoopGuard' ||
                            health.mode !== 'hub' ||
                            health.hubId !== selected.qr.hubId
                          )
                            throw new Error(
                              'The QR does not match the CoopGuard hub at this address.',
                            );
                          setHubServer(selected.server);
                          setScannedHubId(selected.qr.hubId);
                        } catch (scanError) {
                          setError(
                            scanError instanceof Error
                              ? scanError.message
                              : 'Could not connect to this laptop hub.',
                          );
                        }
                      }}
                    />
                    {!!scannedHubId && (
                      <View
                        style={{
                          backgroundColor: colors.greenSoft,
                          borderRadius: 11,
                          padding: 11,
                        }}
                      >
                        <Label weight="bold" style={{ color: colors.green, fontSize: 12 }}>
                          Hub found · {scannedHubId}
                        </Label>
                        <Label style={{ color: colors.green, fontSize: 11 }}>{hubServer}</Label>
                      </View>
                    )}
                    <AuthField
                      label="Laptop hub address · manual fallback"
                      value={hubServer}
                      onChange={(value) => {
                        setHubServer(value);
                        setScannedHubId('');
                      }}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 8,
                        backgroundColor: colors.greenSoft,
                        borderRadius: 11,
                        padding: 11,
                      }}
                    >
                      <Wifi size={17} color={colors.green} />
                      <Label style={{ flex: 1, color: colors.green, fontSize: 11 }}>
                        For WiFi, use the laptop address printed by the hub command. For USB/ADB,
                        keep https://localhost:8443.
                      </Label>
                    </View>
                  </View>
                )}
                <AuthField label="Username" value={username} onChange={setUsername} />
                <AuthField label="Password" value={password} onChange={setPassword} secret />
                {!!(error || auth.error) && (
                  <View
                    style={{
                      backgroundColor: colors.redSoft,
                      borderRadius: 12,
                      padding: 12,
                      flexDirection: 'row',
                      gap: 10,
                    }}
                  >
                    <LockKeyhole size={18} color={colors.red} />
                    <Label
                      accessibilityLiveRegion="polite"
                      style={{ color: colors.red, flex: 1, fontSize: 12 }}
                    >
                      {error || auth.error}
                    </Label>
                  </View>
                )}
                <Button
                  testID="sign-in"
                  icon={LockKeyhole}
                  disabled={busy || !username.trim() || !password}
                  onPress={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await auth.login(
                        username,
                        password,
                        connection === 'hub' ? hubServer : undefined,
                      );
                      setPassword('');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Could not sign in.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </>
            )}
            {changing ? (
              <Button variant="ghost" onPress={() => void auth.logout()}>
                Sign out
              </Button>
            ) : (
              <>
                <View
                  style={{
                    marginTop: 2,
                    backgroundColor: colors.greenSoft,
                    borderRadius: 13,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <ShieldCheck size={20} color={colors.green} />
                  <View style={{ flex: 1 }}>
                    <Label weight="bold" style={{ color: colors.green, fontSize: 12 }}>
                      Works at the farm, even when the internet does not
                    </Label>
                  </View>
                </View>
                <Label style={{ fontSize: 11, color: colors.muted }}>
                  Forgot password? Workers, ask your farm owner. Owners and technicians, contact
                  CoopGuard.
                </Label>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
