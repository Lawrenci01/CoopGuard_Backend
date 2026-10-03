import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bird, LockKeyhole } from 'lucide-react-native';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, Label } from '../components/ui';
import { colors, fonts } from '../theme';

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
  return (
    <View style={{ gap: 6 }}>
      <Label weight="medium">{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={secret ? 128 : 200}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          fontFamily: fonts.regular,
          fontSize: 16,
          color: colors.ink,
          backgroundColor: colors.surface,
        }}
      />
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const changing = !!auth.record?.session.account.mustChangePassword;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bird size={34} color={colors.green} />
            <Label weight="bold" style={{ fontSize: 28, lineHeight: 36, color: colors.green }}>
              CoopGuard
            </Label>
          </View>
          <View style={{ gap: 8 }}>
            <Label weight="bold" style={{ fontSize: 27, lineHeight: 35 }}>
              {changing ? 'Set your password' : 'Welcome back'}
            </Label>
            <Label style={{ color: colors.muted }}>
              {changing
                ? 'Your temporary password must be changed before opening the farm.'
                : 'Sign in with the account supplied by your farm owner or the CoopGuard team.'}
            </Label>
          </View>
          <Card style={{ gap: 18 }}>
            {changing ? (
              <PasswordForm />
            ) : (
              <>
                <AuthField label="Username" value={username} onChange={setUsername} />
                <AuthField label="Password" value={password} onChange={setPassword} secret />
                {!!(error || auth.error) && (
                  <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
                    {error || auth.error}
                  </Label>
                )}
                <Button
                  testID="sign-in"
                  icon={LockKeyhole}
                  disabled={busy || !username.trim() || !password}
                  onPress={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await auth.login(username, password);
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
          </Card>
          {changing ? (
            <Button variant="ghost" onPress={() => void auth.logout()}>
              Sign out
            </Button>
          ) : (
            <>
              <Label style={{ fontSize: 12, color: colors.muted }}>
                Forgot your password? Workers should contact their farm owner. Owners and
                technicians should contact the CoopGuard team.
              </Label>
              <Label style={{ fontSize: 12, color: colors.muted }}>
                CoopGuard uses the cloud on any internet connection and automatically uses the
                paired farm hub while you are on the farm WiFi.
              </Label>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
