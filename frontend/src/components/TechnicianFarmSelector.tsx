import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CircleCheck, Info, QrCode, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseFarmQr } from '../domain/deviceSimulation';
import { useAuth } from '../state/AuthProvider';
import { colors } from '../theme';
import { AuthField } from '../screens/LoginScreen';
import { Button, Card, Chip, Label, styles } from './ui';
import { QrScannerScreen } from './QrScannerScreen';
import { BrandMark, FieldGuideArtwork } from './Brand';

export interface TechnicianFarmSelection {
  method: 'manual' | 'qr';
  farmCode: string;
}

export function TechnicianFarmSelector({
  onSelected,
}: {
  onSelected: (selection: TechnicianFarmSelection) => void;
}) {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [farmCode, setFarmCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const record = auth.record!;
  const initials = record.session.account.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const openFarm = async (code: string, method: TechnicianFarmSelection['method']) => {
    const normalized = code.trim().toUpperCase();
    setBusy(true);
    setError('');
    try {
      await auth.selectFarmByCode(normalized);
      onSelected({ method, farmCode: normalized });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          backgroundColor: colors.greenDark,
          paddingTop: insets.top + 17,
          paddingBottom: 17,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BrandMark size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Label style={{ color: '#FFFFFF9E', fontSize: 10 }}>TECHNICIAN</Label>
          <Label weight="bold" style={{ color: '#fff', fontSize: 21 }}>
            Select farm
          </Label>
        </View>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#FFFFFF33',
            backgroundColor: '#FFFFFF1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Label weight="bold" style={{ color: '#fff', fontSize: 11 }}>
            {initials}
          </Label>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 22,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 }}>
          <View style={{ gap: 8, alignItems: 'center', paddingVertical: 8 }}>
            <FieldGuideArtwork width={116} style={{ borderRadius: 20, marginBottom: 6 }} />
            <Label
              weight="bold"
              style={{ fontSize: 26, lineHeight: 32, textAlign: 'center', letterSpacing: -0.7 }}
            >
              Open a farm setup
            </Label>
            <Label style={{ color: colors.muted, textAlign: 'center', maxWidth: 430 }}>
              Enter a Farm ID or scan its setup QR. You must already be signed in.
            </Label>
          </View>

          <Card style={{ gap: 14 }}>
            <View style={styles.row}>
              <ShieldCheck size={22} color={colors.green} />
              <Label weight="bold" style={{ flex: 1 }}>
                Select the farm for this visit
              </Label>
            </View>
            <AuthField label="Farm ID" value={farmCode} onChange={setFarmCode} />
            <Label style={{ color: colors.muted, fontSize: 11 }}>
              Farm QR identifies a farm only. It is not authentication.
            </Label>
            <Button
              testID="open-technician-farm"
              disabled={busy || !farmCode.trim()}
              onPress={async () => {
                try {
                  await openFarm(farmCode, 'manual');
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not open this farm.');
                }
              }}
            >
              Open farm setup
            </Button>
            <View style={[styles.row, { width: '100%' }]}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Label style={{ color: colors.muted, fontSize: 10 }}>or</Label>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            <Button
              testID="scan-technician-farm"
              icon={QrCode}
              variant="secondary"
              onPress={() => setScanning(true)}
            >
              Scan Farm QR
            </Button>
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              <Info size={15} color={colors.muted} />
              <Label style={{ color: colors.muted, fontSize: 10, flex: 1 }}>
                Camera permission is requested only when the scanner opens.
              </Label>
            </View>
          </Card>

          <Card style={{ ...styles.row, gap: 11 }}>
            <View
              style={{
                width: 39,
                height: 39,
                borderRadius: 12,
                backgroundColor: colors.greenDark,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Label weight="bold" style={{ color: '#fff', fontSize: 11 }}>
                {initials}
              </Label>
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ color: colors.muted, fontSize: 9 }}>Signed in technician</Label>
              <Label weight="bold" style={{ fontSize: 12 }}>
                {record.session.account.name}
              </Label>
              <Label style={{ color: colors.muted, fontSize: 9 }}>CoopGuard Field Services</Label>
            </View>
            <Chip tone="green">
              <CircleCheck size={11} color={colors.green} /> Verified
            </Chip>
          </Card>

          {!!error && <Label style={{ color: colors.red }}>{error}</Label>}
          <Button variant="ghost" onPress={() => void auth.logout()}>
            Sign out
          </Button>
        </View>
      </ScrollView>

      <QrScannerScreen
        visible={scanning}
        title="Scan Farm QR"
        instruction="Align the farm setup QR inside the frame. Successful scanning opens only that farm."
        testID="technician-farm-qr-camera"
        onClose={() => setScanning(false)}
        onScanned={async (data) => {
          setScanning(false);
          try {
            await openFarm(parseFarmQr(data), 'qr');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not open this farm.');
          }
        }}
      />
    </View>
  );
}
