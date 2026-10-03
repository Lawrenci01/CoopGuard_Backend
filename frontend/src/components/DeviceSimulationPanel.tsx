import { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { QrCode, RadioTower } from 'lucide-react-native';
import { deviceSetupProgress, pairingQr } from '../domain/deviceSimulation';
import type { Section } from '../domain/types';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { colors } from '../theme';
import { Button, Card, Chip, Choice, Label, Sheet, styles } from './ui';

function QrCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 14 }}>
        <QRCode value={value} size={178} color={colors.ink} backgroundColor="#fff" />
      </View>
      <Label weight="bold">{label}</Label>
      <Label style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
        Simulation pairing reference. It contains no account password.
      </Label>
    </View>
  );
}

function PairingScanner({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { perform } = useFarm();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  return (
    <Sheet visible={visible} title="Scan CoopGuard QR" onClose={onClose}>
      <View style={{ gap: 14 }}>
        {!permission?.granted ? (
          <>
            <Label>Camera access is needed only while scanning a hub or node QR code.</Label>
            <Button onPress={() => void requestPermission()}>Allow camera</Button>
          </>
        ) : (
          <View style={{ height: 360, overflow: 'hidden', borderRadius: 18 }}>
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={
                busy
                  ? undefined
                  : async ({ data }) => {
                      setBusy(true);
                      const ok = await perform(
                        { type: 'pairVirtualDevice', qr: data },
                        'Virtual device paired and reporting.',
                      );
                      setBusy(false);
                      if (ok) onClose();
                    }
              }
            />
          </View>
        )}
        <Label style={{ color: colors.muted }}>
          For one-phone testing, use the “Pair this simulated device” button beside its generated
          QR. Use the camera with a printed QR or a second screen.
        </Label>
      </View>
    </Sheet>
  );
}

export function DeviceSimulationPanel() {
  const auth = useAuth();
  const { data, perform } = useFarm();
  const [section, setSection] = useState<Section>('A');
  const [scanner, setScanner] = useState(false);
  const farm = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;
  const simulation = data.deviceSimulation;
  const hub = simulation.hub;
  const progress = deviceSetupProgress(data.site, simulation);
  const hubQr =
    hub &&
    pairingQr({
      version: 1,
      kind: 'hub',
      farmCode: hub.farmCode,
      deviceId: hub.id,
      pairingCode: hub.pairingCode,
    });

  if (!data.site.survey || !data.site.plan) return null;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Label weight="bold" style={{ fontSize: 18 }}>
              Hub and sensor-node installation
            </Label>
            <Label style={{ color: colors.muted }}>
              Farm ID {farm.code} · hardware-flow simulation
            </Label>
          </View>
          <Chip tone={progress.ready ? 'green' : 'amber'}>
            {progress.ready ? 'Devices ready' : 'Setup incomplete'}
          </Chip>
        </View>
        <Label>
          Pair the hub first. Then add each planned sensor node, choose its house section, and
          confirm that it reports through the hub.
        </Label>
        {progress.missing.map((item) => (
          <Label key={item}>• {item}</Label>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <RadioTower size={21} color={colors.green} />
          <Label weight="bold" style={{ flex: 1 }}>
            Farm hub
          </Label>
          {hub && <Chip tone={hub.status === 'reporting' ? 'green' : 'amber'}>{hub.status}</Chip>}
        </View>
        {!hub ? (
          <Button
            testID="create-virtual-hub"
            onPress={() =>
              void perform(
                { type: 'createVirtualHub', farmCode: farm.code },
                'Farm hub record created.',
              )
            }
          >
            Create hub QR
          </Button>
        ) : (
          <>
            <Label>{hub.id}</Label>
            {hub.status === 'created' && hubQr && (
              <>
                <QrCard value={hubQr} label={hub.id} />
                <Button
                  testID="pair-virtual-hub"
                  onPress={() =>
                    void perform(
                      { type: 'pairVirtualDevice', qr: hubQr },
                      'Hub paired and reporting.',
                    )
                  }
                >
                  Confirm this hub for simulation
                </Button>
              </>
            )}
            <Button variant="ghost" onPress={() => setScanner(true)} icon={QrCode}>
              Scan hub or node QR
            </Button>
            {!['normal_monitor', 'normal_control'].includes(data.site.status) && (
              <Button
                variant="danger"
                onPress={() => void perform({ type: 'removeVirtualDevice', id: hub.id })}
              >
                Remove hub
              </Button>
            )}
          </>
        )}
      </Card>

      {hub?.status === 'reporting' && (
        <Card style={{ gap: 14 }}>
          <Label weight="bold" style={{ fontSize: 17 }}>
            Sensor nodes · {progress.reportingNodes}/{progress.requiredNodes} reporting
          </Label>
          <Label style={{ color: colors.muted }}>
            Every node has temperature, humidity, ammonia, carbon dioxide, and litter-moisture
            sensors. Sound analysis is coming soon while the hub AI model is being trained.
          </Label>
          <Label weight="bold">House section</Label>
          <Choice
            values={['A', 'B', 'C']}
            selected={section}
            labels={{ A: 'Section A', B: 'Section B', C: 'Section C' }}
            onSelect={setSection}
          />
          <Button
            testID="create-virtual-node"
            onPress={() =>
              void perform(
                { type: 'createVirtualNode', farmCode: farm.code, section },
                'Sensor node QR created.',
              )
            }
          >
            Create sensor node QR
          </Button>
          {simulation.nodes.map((node) => {
            const qr = pairingQr({
              version: 1,
              kind: 'node',
              farmCode: node.farmCode,
              deviceId: node.id,
              pairingCode: node.pairingCode,
            });
            return (
              <Card key={node.id} style={{ gap: 10, padding: 15 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <Label weight="bold">{node.id}</Label>
                    <Label style={{ color: colors.muted }}>
                      Full sensor set · Section {node.section}
                    </Label>
                  </View>
                  <Chip tone={node.status === 'reporting' ? 'green' : 'amber'}>{node.status}</Chip>
                </View>
                {node.status === 'created' && (
                  <>
                    <QrCard value={qr} label={node.id} />
                    <Button
                      testID={`pair-${node.id}`}
                      onPress={() =>
                        void perform(
                          { type: 'pairVirtualDevice', qr },
                          'Sensor node paired and reporting.',
                        )
                      }
                    >
                      Confirm this node for simulation
                    </Button>
                  </>
                )}
                {!['normal_monitor', 'normal_control'].includes(data.site.status) && (
                  <Button
                    variant="danger"
                    onPress={() => void perform({ type: 'removeVirtualDevice', id: node.id })}
                  >
                    Remove node
                  </Button>
                )}
              </Card>
            );
          })}
        </Card>
      )}
      <PairingScanner visible={scanner} onClose={() => setScanner(false)} />
    </View>
  );
}
