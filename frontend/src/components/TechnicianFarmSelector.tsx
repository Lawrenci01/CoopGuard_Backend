import { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QrCode, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseFarmQr } from '../domain/deviceSimulation';
import { useAuth } from '../state/AuthProvider';
import { colors } from '../theme';
import { AuthField } from '../screens/LoginScreen';
import { Button, Card, Chip, Label } from './ui';

export function TechnicianFarmSelector({ onSelected }: { onSelected: () => void }) {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [farmCode, setFarmCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const record = auth.record!;

  const openFarm = async (code: string) => {
    setBusy(true);
    setError('');
    try {
      await auth.selectFarmByCode(code);
      onSelected();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 18,
      }}
    >
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 18 }}>
        <View style={{ gap: 5 }}>
          <Chip tone="blue">TECHNICIAN</Chip>
          <Label weight="bold" style={{ fontSize: 27, lineHeight: 35 }}>
            Select the farm for this visit
          </Label>
          <Label style={{ color: colors.muted }}>
            Enter the Farm ID or scan the Farm QR before opening survey and installation records.
          </Label>
        </View>

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color={colors.green} />
            <Label weight="bold" style={{ flex: 1 }}>
              Open a farm setup
            </Label>
          </View>
          <AuthField label="Farm ID" value={farmCode} onChange={setFarmCode} />
          <Button
            testID="open-technician-farm"
            disabled={busy || !farmCode.trim()}
            onPress={async () => {
              try {
                await openFarm(farmCode);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not open this farm.');
              }
            }}
          >
            Open farm setup
          </Button>
          <Button icon={QrCode} variant="secondary" onPress={() => setScanning(true)}>
            Scan Farm QR
          </Button>
          <Label style={{ color: colors.muted, fontSize: 12 }}>
            Entering or scanning the Farm ID selects the farm for this visit. Farm readings are not
            loaded on this screen.
          </Label>
        </Card>

        {scanning && (
          <Card style={{ gap: 12 }}>
            {!permission?.granted ? (
              <Button onPress={() => void requestPermission()}>Allow camera</Button>
            ) : (
              <View style={{ height: 360, overflow: 'hidden', borderRadius: 18 }}>
                <CameraView
                  testID="technician-farm-qr-camera"
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={
                    busy
                      ? undefined
                      : async ({ data }) => {
                          setScanning(false);
                          try {
                            await openFarm(parseFarmQr(data));
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Could not open this farm.');
                          }
                        }
                  }
                />
              </View>
            )}
            <Button variant="ghost" onPress={() => setScanning(false)}>
              Cancel scan
            </Button>
          </Card>
        )}

        {!!error && <Label style={{ color: colors.red }}>{error}</Label>}
        <Label style={{ color: colors.muted }}>
          Signed in as {record.session.account.name}. Enter the Farm ID supplied for the visit.
        </Label>
        <Button variant="ghost" onPress={() => void auth.logout()}>
          Sign out
        </Button>
      </View>
    </View>
  );
}
