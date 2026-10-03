import type { SiteWorkflow } from './siteWorkflow';
import { createDemoSnapshot } from '../data/fixtures';
import type { FarmAlert, FarmSnapshot, Section } from './types';

export type VirtualDeviceStatus = 'created' | 'paired' | 'reporting';

export interface VirtualHub {
  id: string;
  farmCode: string;
  pairingCode: string;
  status: VirtualDeviceStatus;
  createdAt: number;
  pairedAt?: number;
  firmwareVersion?: string;
  firmwareUpdatedAt?: number;
}

export interface VirtualNode {
  id: string;
  farmCode: string;
  pairingCode: string;
  section: 'A' | 'B' | 'C';
  status: VirtualDeviceStatus;
  createdAt: number;
  pairedAt?: number;
  hubId?: string;
  x?: number;
  y?: number;
  firmwareVersion?: string;
  firmwareUpdatedAt?: number;
}

export interface DeviceHistoryEntry {
  id: string;
  deviceId: string;
  action: 'calibrated' | 'configured' | 'firmware_updated';
  details: string;
  createdAt: number;
}

export interface DeviceSimulation {
  enabled: true;
  hub: VirtualHub | null;
  nodes: VirtualNode[];
  history: DeviceHistoryEntry[];
}

export interface DeviceSetupProgress {
  ready: boolean;
  requiredNodes: number;
  reportingNodes: number;
  missing: string[];
}

export function emptyDeviceSimulation(): DeviceSimulation {
  return { enabled: true, hub: null, nodes: [], history: [] };
}

export function recordDeviceEvent(simulation: DeviceSimulation, event: DeviceHistoryEntry) {
  simulation.history ??= [];
  simulation.history.unshift(event);
  simulation.history = simulation.history.slice(0, 500);
}

export function deviceSetupProgress(
  site: SiteWorkflow,
  simulation: DeviceSimulation,
): DeviceSetupProgress {
  const missing: string[] = [];
  if (!site.survey || !site.plan) missing.push('Complete the house survey and generate its plan.');
  if (!simulation.hub || simulation.hub.status !== 'reporting')
    missing.push('Pair a virtual hub and confirm its heartbeat.');
  const reporting = simulation.nodes.filter((node) => node.status === 'reporting');
  const requiredNodes = site.plan?.nodeCount ?? 0;
  if (reporting.length < requiredNodes)
    missing.push(`Pair ${requiredNodes - reporting.length} more reporting node(s).`);
  return { ready: missing.length === 0, requiredNodes, reportingNodes: reporting.length, missing };
}

export function snapshotForDeviceSimulation(
  snapshot: FarmSnapshot,
  simulation: DeviceSimulation,
): FarmSnapshot {
  const sample = createDemoSnapshot(snapshot.sampledAt);
  const sectionPositions = new Map<Section, number>();
  const sections: Section[] = ['A', 'B', 'C'];
  const sensors = simulation.nodes.map((node, index) => {
    const sectionIndex = sections.indexOf(node.section);
    const sectionSensors = sample.sensors.filter((sensor) => sensor.section === node.section);
    const position = sectionPositions.get(node.section) ?? 0;
    sectionPositions.set(node.section, position + 1);
    const base = sectionSensors[position % sectionSensors.length]!;
    const countInSection = simulation.nodes.filter((item) => item.section === node.section).length;
    return {
      ...base,
      id: node.id,
      number: String(index + 1).padStart(2, '0'),
      section: node.section,
      x: sectionIndex / 3 + (position + 1) / (countInSection + 1) / 3,
      y: 0.5,
      online: node.status === 'reporting',
      control: false,
      battery: null,
      signal: node.status === 'reporting' ? ('strong' as const) : ('weak' as const),
    };
  });
  const alerts = sensors.flatMap<FarmAlert>((sensor) => {
    const previous = snapshot.alerts.find(
      (alert) => alert.section === sensor.section && alert.status !== 'resolved',
    );
    if (!sensor.online) {
      return [
        {
          id: previous?.id ?? `node-offline-${sensor.id}`,
          titleKey: 'sensorAlert',
          section: sensor.section,
          severity: 'info',
          status: previous?.status ?? 'active',
          detectedAt: previous?.detectedAt ?? snapshot.sampledAt,
          acknowledgedAt: previous?.acknowledgedAt,
          metric: null,
          sensorId: sensor.id,
          action: 'none',
        },
      ];
    }
    if (sensor.conditions.temperature === 'watch' || sensor.conditions.temperature === 'urgent') {
      return [
        {
          id: previous?.id ?? `node-heat-${sensor.id}`,
          titleKey: 'heatAlert',
          section: sensor.section,
          severity: 'warning',
          status: previous?.status ?? 'active',
          detectedAt: previous?.detectedAt ?? snapshot.sampledAt,
          acknowledgedAt: previous?.acknowledgedAt,
          metric: 'temperature',
          sensorId: sensor.id,
          action: 'none',
        },
      ];
    }
    return [];
  });
  return { ...snapshot, sensors, alerts };
}

type PairingPayload =
  | { version: 1; kind: 'hub'; farmCode: string; deviceId: string; pairingCode: string }
  | {
      version: 1;
      kind: 'node';
      farmCode: string;
      deviceId: string;
      pairingCode: string;
    };

export function pairingQr(payload: PairingPayload) {
  const params = new URLSearchParams({
    version: String(payload.version),
    farm: payload.farmCode,
    device: payload.deviceId,
    code: payload.pairingCode,
  });
  return `coopguard://${payload.kind}/pair?${params.toString()}`;
}

export function farmQr(farmCode: string) {
  if (!/^CG-[A-Z0-9-]{4,32}$/.test(farmCode)) throw new Error('The Farm ID is invalid.');
  return `coopguard://farm/open?version=1&farm=${encodeURIComponent(farmCode)}`;
}

export function parseFarmQr(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('This is not a CoopGuard Farm QR code.');
  }
  const farmCode = url.searchParams.get('farm') ?? '';
  if (
    url.protocol !== 'coopguard:' ||
    url.hostname !== 'farm' ||
    url.pathname !== '/open' ||
    url.searchParams.get('version') !== '1' ||
    !/^CG-[A-Z0-9-]{4,32}$/.test(farmCode)
  )
    throw new Error('This CoopGuard Farm QR code is incomplete or invalid.');
  return farmCode;
}

export function parsePairingQr(value: string): PairingPayload {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('This is not a CoopGuard pairing QR code.');
  }
  const kind = url.hostname;
  const farmCode = url.searchParams.get('farm') ?? '';
  const deviceId = url.searchParams.get('device') ?? '';
  const pairingCode = url.searchParams.get('code') ?? '';
  if (
    url.protocol !== 'coopguard:' ||
    url.pathname !== '/pair' ||
    (kind !== 'hub' && kind !== 'node') ||
    url.searchParams.get('version') !== '1' ||
    !/^CG-[A-Z0-9-]{4,32}$/.test(farmCode) ||
    !/^(HUB|NODE)-[A-Z0-9]{6,16}$/.test(deviceId) ||
    !/^[A-Z0-9]{10,40}$/.test(pairingCode)
  )
    throw new Error('This CoopGuard QR code is incomplete or invalid.');
  return { version: 1, kind, farmCode, deviceId, pairingCode };
}

export function validDeviceSimulation(value: unknown): value is DeviceSimulation {
  try {
    const simulation = value as DeviceSimulation;
    if (!simulation || simulation.enabled !== true || !Array.isArray(simulation.nodes))
      return false;
    const statuses = ['created', 'paired', 'reporting'];
    const validBase = (item: VirtualHub | VirtualNode) =>
      /^(HUB|NODE)-[A-Z0-9]{6,16}$/.test(item.id) &&
      /^CG-[A-Z0-9-]{4,32}$/.test(item.farmCode) &&
      /^[A-Z0-9]{10,40}$/.test(item.pairingCode) &&
      statuses.includes(item.status) &&
      Number.isFinite(item.createdAt) &&
      (item.pairedAt === undefined || Number.isFinite(item.pairedAt));
    const validHub =
      simulation.hub === null ||
      (validBase(simulation.hub) &&
        simulation.hub.id.startsWith('HUB-') &&
        (simulation.hub.firmwareVersion === undefined ||
          typeof simulation.hub.firmwareVersion === 'string') &&
        (simulation.hub.firmwareUpdatedAt === undefined ||
          Number.isFinite(simulation.hub.firmwareUpdatedAt)));
    const validNodes =
      simulation.nodes.length <= 1000 &&
      new Set(simulation.nodes.map((node) => node.id)).size === simulation.nodes.length &&
      simulation.nodes.every(
        (node) =>
          validBase(node) &&
          node.id.startsWith('NODE-') &&
          ['A', 'B', 'C'].includes(node.section) &&
          (node.hubId === undefined || /^HUB-[A-Z0-9]{6,16}$/.test(node.hubId)) &&
          (node.x === undefined || (Number.isFinite(node.x) && node.x >= 0 && node.x <= 1)) &&
          (node.y === undefined || (Number.isFinite(node.y) && node.y >= 0 && node.y <= 1)) &&
          (node.firmwareVersion === undefined || typeof node.firmwareVersion === 'string') &&
          (node.firmwareUpdatedAt === undefined || Number.isFinite(node.firmwareUpdatedAt)),
      );
    const history = simulation.history ?? [];
    const validHistory =
      Array.isArray(history) &&
      history.length <= 500 &&
      history.every(
        (event) =>
          typeof event.id === 'string' &&
          typeof event.deviceId === 'string' &&
          ['calibrated', 'configured', 'firmware_updated'].includes(event.action) &&
          typeof event.details === 'string' &&
          Number.isFinite(event.createdAt),
      );
    return validHub && validNodes && validHistory;
  } catch {
    return false;
  }
}
