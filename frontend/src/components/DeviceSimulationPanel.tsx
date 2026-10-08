import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { QrCode, RadioTower, RefreshCw } from 'lucide-react-native';
import { houseGrid } from '../domain/houseLayout';
import { parseLaptopHubQr } from '../domain/hubPairing';
import type { Section } from '../domain/types';
import { api } from '../services/api';
import type { FarmDevices } from '../services/apiTypes';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { colors, fonts } from '../theme';
import { Button, Card, Chip, Choice, Label, Sheet, styles } from './ui';
import { QrScannerScreen } from './QrScannerScreen';

type Transport = 'wifi' | 'usb';

function parseNodeQr(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('This is not a CoopGuard hub or sensor-node QR code.');
  }
  const qr = parsed as Record<string, unknown>;
  if (
    qr.type !== 'coopguard-node' ||
    qr.version !== 1 ||
    typeof qr.hubId !== 'string' ||
    typeof qr.nodeId !== 'string' ||
    typeof qr.section !== 'string' ||
    !/^[A-Z]{1,4}$/.test(qr.section)
  )
    throw new Error('This CoopGuard sensor-node QR code is incomplete or invalid.');
  return { hubId: qr.hubId, nodeId: qr.nodeId, section: qr.section as Section };
}

export function DeviceSimulationPanel() {
  const auth = useAuth();
  const farm = useFarm();
  const [devices, setDevices] = useState<FarmDevices | null>(null);
  const [section, setSection] = useState<Section>('A');
  const [nodeId, setNodeId] = useState('');
  const [scanner, setScanner] = useState(false);
  const [transport, setTransport] = useState<Transport>('wifi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removeNodeId, setRemoveNodeId] = useState<string | null>(null);
  const record = auth.record!;
  const target = record.session.farms.find((item) => item.id === record.farmId)!;
  const layout = houseGrid(
    farm.data.site.survey?.house.lengthMetres ?? 90,
    farm.data.site.survey?.house.widthMetres ?? 12,
  );
  const selectedSection = layout.sections.includes(section) ? section : layout.sections[0]!;
  const sectionLabels = Object.fromEntries(
    layout.sections.map((value) => [value, `Section ${value}`]),
  ) as Record<Section, string>;

  const load = async () => {
    if (!auth.online) return;
    setError('');
    try {
      setDevices(await api.devices(auth.server, record.session.token, record.farmId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load devices.');
    }
  };

  useEffect(() => {
    void load();
  }, [auth.server, record.farmId]);

  const registerNode = async (requestedId?: string, requestedSection = selectedSection) => {
    setBusy(true);
    setError('');
    try {
      const added = await api.addNode(
        auth.server,
        record.session.token,
        record.farmId,
        requestedSection,
        requestedId?.trim() || undefined,
      );
      setNodeId('');
      await load();
      await farm.refresh();
      farm.notify(`${added.nodeId} registered. The hub simulator will begin reporting for it.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not register node.');
    } finally {
      setBusy(false);
    }
  };

  if (!farm.data.site.survey || !farm.data.site.plan) return null;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Label weight="bold" style={{ fontSize: 18 }}>
              Hub and sensor-node installation
            </Label>
            <Label style={{ color: colors.muted }}>
              Farm ID {target.code} · persistent device records
            </Label>
          </View>
          <Button compact variant="ghost" icon={RefreshCw} onPress={() => void load()}>
            Refresh
          </Button>
        </View>
        <Label>
          Scan and register the laptop hub first. Add each sensor node under that hub; all roles
          then read the same saved records.
        </Label>
        {!!error && <Label style={{ color: colors.red }}>{error}</Label>}
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <RadioTower size={21} color={colors.green} />
          <Label weight="bold" style={{ flex: 1 }}>
            Farm hub
          </Label>
          {devices?.hub && <Chip tone="green">paired</Chip>}
        </View>
        {!devices ? (
          <ActivityIndicator color={colors.green} />
        ) : devices.hub ? (
          <>
            <Label weight="bold">{devices.hub.id}</Label>
            <Label style={{ color: colors.muted, fontSize: 11 }}>
              {devices.hub.source === 'simulated' ? 'Laptop simulation' : 'Physical hardware'} ·{' '}
              {devices.hub.lastSeenAt
                ? `last transmission ${new Date(devices.hub.lastSeenAt).toLocaleString()}`
                : 'waiting for first transmission'}
            </Label>
          </>
        ) : (
          <>
            <Choice
              values={['wifi', 'usb']}
              selected={transport}
              labels={{ wifi: 'Local WiFi', usb: 'USB cable' }}
              onSelect={setTransport}
            />
            <Button testID="create-virtual-hub" icon={QrCode} onPress={() => setScanner(true)}>
              Add Hub · Scan QR
            </Button>
          </>
        )}
      </Card>

      {!!devices?.hub && (
        <Card style={{ gap: 14 }}>
          <Label weight="bold" style={{ fontSize: 17 }}>
            Sensor nodes · {devices.nodes.length} registered
          </Label>
          <Label style={{ color: colors.muted }}>
            Each standard node reports temperature, humidity, ammonia, carbon dioxide, and one
            litter-moisture reading. Three installed nodes provide three litter measurement points.
          </Label>
          <Label style={{ color: colors.muted }}>
            Coverage plan: {layout.count} {layout.count === 1 ? 'section' : 'sections'} in a{' '}
            {layout.columns}×{layout.rows} portrait grid.
          </Label>
          <Label weight="bold">House section</Label>
          <Choice
            values={layout.sections}
            selected={selectedSection}
            labels={sectionLabels}
            onSelect={setSection}
          />
          <TextInput
            accessibilityLabel="Sensor Node ID"
            value={nodeId}
            onChangeText={setNodeId}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Optional Node ID from hardware label"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 13,
              fontFamily: fonts.regular,
              color: colors.ink,
              backgroundColor: colors.surface,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="create-virtual-node"
                disabled={busy}
                onPress={() => void registerNode(nodeId)}
              >
                {busy ? 'Registering…' : 'Add Node'}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" icon={QrCode} onPress={() => setScanner(true)}>
                Scan QR
              </Button>
            </View>
          </View>

          {devices.nodes.map((node) => (
            <Card key={node.nodeId} style={{ gap: 9, padding: 15 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Label weight="bold">{node.nodeId}</Label>
                  <Label style={{ color: colors.muted, fontSize: 11 }}>
                    Section {node.section} ·{' '}
                    {node.source === 'simulated' ? 'simulated' : 'hardware'}
                  </Label>
                </View>
                <Chip tone={node.receivedAt ? 'green' : 'amber'}>
                  {node.receivedAt ? 'reporting' : 'waiting'}
                </Chip>
              </View>
              {node.readings && (
                <Label style={{ color: colors.muted, fontSize: 11 }}>
                  {node.readings.temperature.toFixed(1)} °C · {node.readings.humidity.toFixed(0)}%
                  RH · {node.readings.ammonia.toFixed(1)} ppm NH₃ · {node.readings.co2.toFixed(0)}{' '}
                  ppm CO₂
                </Label>
              )}
              <Button variant="danger" onPress={() => setRemoveNodeId(node.nodeId)}>
                Remove node
              </Button>
            </Card>
          ))}
        </Card>
      )}

      <QrScannerScreen
        visible={scanner}
        title={devices?.hub ? 'Scan Hub or Sensor Node QR' : 'Scan Laptop Hub QR'}
        instruction="Align the CoopGuard device QR inside the frame. Its identity and farm assignment will be validated."
        onClose={() => setScanner(false)}
        onScanned={async (value) => {
          setScanner(false);
          setError('');
          try {
            try {
              parseLaptopHubQr(value);
              const status = await auth.pairHub(value, transport);
              if (status === 'replacement_pending')
                farm.notify('Hub replacement sent to an administrator for approval.');
              else farm.notify('Hub paired to this farm.');
              await load();
            } catch (hubError) {
              if (value.trim().includes('coopguard-hub')) throw hubError;
              const node = parseNodeQr(value);
              if (!devices?.hub || node.hubId !== devices.hub.id)
                throw new Error('This sensor node belongs to a different hub.');
              await registerNode(node.nodeId, node.section);
            }
          } catch (scanError) {
            setError(
              scanError instanceof Error ? scanError.message : 'Could not pair this device.',
            );
          }
        }}
      />

      <Sheet
        visible={!!removeNodeId}
        title="Remove sensor node?"
        onClose={() => setRemoveNodeId(null)}
      >
        <View style={{ gap: 14 }}>
          <Label weight="bold">{removeNodeId}</Label>
          <Label>
            The node will stop reporting, but its historical readings will remain in SQLite.
          </Label>
          <Button
            testID="confirm-remove-sensor-node"
            variant="danger"
            onPress={async () => {
              if (!removeNodeId) return;
              setBusy(true);
              try {
                await api.removeNode(
                  auth.server,
                  record.session.token,
                  record.farmId,
                  removeNodeId,
                );
                setRemoveNodeId(null);
                await load();
                await farm.refresh();
                farm.notify('Sensor node removed. Historical readings were retained.');
              } catch (requestError) {
                setError(
                  requestError instanceof Error ? requestError.message : 'Could not remove node.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove sensor node
          </Button>
          <Button variant="secondary" onPress={() => setRemoveNodeId(null)}>
            Cancel
          </Button>
        </View>
      </Sheet>
    </View>
  );
}
