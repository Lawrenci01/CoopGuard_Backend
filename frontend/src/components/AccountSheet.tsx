import { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QrCode } from 'lucide-react-native';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { AuthField, PasswordForm } from '../screens/LoginScreen';
import { Button, Label, Sheet } from './ui';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { parseFarmQr } from '../domain/deviceSimulation';

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const auth = useAuth(),
    farm = useFarm();
  const [password, setPassword] = useState(false),
    [confirmImport, setConfirmImport] = useState(false),
    [hubSetup, setHubSetup] = useState(false),
    [hubAddress, setHubAddress] = useState(auth.hubServer ?? 'https://coopguard-hub.local:8443'),
    [farmCode, setFarmCode] = useState(''),
    [scanFarm, setScanFarm] = useState(false),
    [cameraPermission, requestCameraPermission] = useCameraPermissions(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const r = auth.record!;
  const openFarm = async (code: string) => {
    await auth.selectFarmByCode(code);
    setFarmCode('');
  };
  return (
    <Sheet
      visible={visible}
      title={password ? 'Change password' : 'Your account'}
      onClose={() => {
        setPassword(false);
        setConfirmImport(false);
        setHubSetup(false);
        setScanFarm(false);
        setError('');
        onClose();
      }}
    >
      {password ? (
        <PasswordForm onDone={() => setPassword(false)} />
      ) : (
        <View style={{ gap: 16 }}>
          <Label weight="bold">{r.session.account.name}</Label>
          <Label>
            {r.session.account.username} · {en.role[r.session.account.role]}
          </Label>
          <Label>{r.session.farms.find((f) => f.id === r.farmId)?.name}</Label>
          <Label style={{ color: colors.muted }}>
            Farm ID {r.session.farms.find((f) => f.id === r.farmId)?.code}
          </Label>
          {r.session.farms.length > 1 &&
            r.session.farms.map((f) => (
              <Button
                key={f.id}
                variant="secondary"
                disabled={f.id === r.farmId}
                onPress={() => void auth.selectFarm(f.id)}
              >
                {f.name}
              </Button>
            ))}
          {r.session.account.role === 'technician' && (
            <View style={{ gap: 10 }}>
              <AuthField label="Farm ID" value={farmCode} onChange={setFarmCode} />
              <Button
                variant="secondary"
                onPress={async () => {
                  try {
                    setError('');
                    await openFarm(farmCode);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not open this farm.');
                  }
                }}
              >
                Open farm
              </Button>
              <Button icon={QrCode} variant="ghost" onPress={() => setScanFarm(true)}>
                Scan Farm QR
              </Button>
              {scanFarm && (
                <View style={{ gap: 10 }}>
                  {!cameraPermission?.granted ? (
                    <Button onPress={() => void requestCameraPermission()}>Allow camera</Button>
                  ) : (
                    <View style={{ height: 300, borderRadius: 18, overflow: 'hidden' }}>
                      <CameraView
                        style={{ flex: 1 }}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={async ({ data }) => {
                          setScanFarm(false);
                          try {
                            setError('');
                            await openFarm(parseFarmQr(data));
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Could not open this farm.');
                          }
                        }}
                      />
                    </View>
                  )}
                  <Button variant="ghost" onPress={() => setScanFarm(false)}>
                    Cancel scan
                  </Button>
                </View>
              )}
              <Label style={{ color: colors.muted, fontSize: 12 }}>
                A Farm ID selects a registered farm. The signed-in technician role authorizes
                access.
              </Label>
            </View>
          )}
          <Label style={{ color: colors.muted }}>
            {farm.context.connection === 'local'
              ? 'Connected on farm WiFi'
              : farm.context.connection === 'cloud'
                ? 'Connected remotely'
                : 'Server unavailable · saved readings'}
            {farm.lastSyncedAt
              ? ` · synced ${relativeTime(farm.lastSyncedAt, farm.now).toLowerCase()}`
              : ''}
          </Label>
          <View style={{ gap: 5 }}>
            <Label weight="medium">
              Farm hub:{' '}
              {auth.hubOnline ? 'connected' : auth.hubServer ? 'not reachable' : 'not paired'}
            </Label>
            <Label weight="medium">Cloud: {auth.cloudOnline ? 'connected' : 'not reachable'}</Label>
            <Label style={{ fontSize: 12, color: colors.muted }}>
              {auth.activeConnection === 'hub'
                ? 'This phone is using the farm hub.'
                : auth.activeConnection === 'cloud'
                  ? 'This phone is using the cloud service.'
                  : 'This phone is showing its saved copy.'}
            </Label>
          </View>
          {!!farm.pendingCount && (
            <Label>{farm.pendingCount} inspection note(s) waiting to sync.</Label>
          )}
          <Button variant="secondary" disabled={farm.syncing} onPress={() => void farm.refresh()}>
            {farm.syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          {r.session.account.role === 'technician' && (
            <>
              <Button
                testID="hub-setup"
                variant="secondary"
                onPress={() => {
                  setHubAddress(auth.hubServer ?? 'https://coopguard-hub.local:8443');
                  setHubSetup(!hubSetup);
                }}
              >
                {auth.hubServer ? 'Farm hub settings' : 'Pair farm hub'}
              </Button>
              {hubSetup && (
                <View style={{ gap: 12 }}>
                  <AuthField
                    label="Farm hub HTTPS address"
                    value={hubAddress}
                    onChange={setHubAddress}
                  />
                  <Label style={{ fontSize: 12, color: colors.muted }}>
                    Enter this once during commissioning. Owners and workers never need to enter an
                    address; their app detects this saved hub whenever the farm WiFi can reach it.
                  </Label>
                  <Button
                    testID="save-hub-pairing"
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await auth.pairHub(hubAddress);
                        setHubSetup(false);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Could not pair the farm hub.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Verify and pair hub
                  </Button>
                  {auth.hubServer && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onPress={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          await auth.forgetHub();
                          setHubSetup(false);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : 'Could not remove the pairing.',
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Remove hub pairing
                    </Button>
                  )}
                </View>
              )}
            </>
          )}
          <Label style={{ fontSize: 12, color: colors.muted }}>
            The same account is used by the cloud and the paired farm hub. Sensor readings and
            equipment responses are still samples.
          </Label>
          <Button variant="ghost" onPress={() => setPassword(true)}>
            Change password
          </Button>
          {r.session.account.role === 'technician' && farm.hasLegacy && farm.revision === 0 && (
            <>
              <Button
                testID="import-phone-records"
                variant="secondary"
                onPress={() => setConfirmImport(true)}
              >
                Import previous phone records
              </Button>
              {confirmImport && (
                <>
                  <Label>
                    Copy this phone’s earlier records into this farm for technician review? Only use
                    this if they belong to this farm. The original phone copy is kept. Imported
                    equipment details remain unverified until you complete the site survey.
                  </Label>
                  <Button
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await farm.importLegacy();
                        setConfirmImport(false);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Import failed.');
                        await auth.rejected(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm import
                  </Button>
                  <Button variant="ghost" onPress={() => setConfirmImport(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </>
          )}
          {!!error && <Label style={{ color: colors.red }}>{error}</Label>}
          <Button
            testID="sign-out"
            variant="secondary"
            onPress={async () => {
              try {
                await auth.logout();
              } catch {
                setError('Could not clear the saved session. Please try signing out again.');
              }
            }}
          >
            Sign out
          </Button>
        </View>
      )}
    </Sheet>
  );
}
