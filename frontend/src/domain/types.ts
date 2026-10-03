export type TabName = 'Dashboard' | 'Alerts' | 'Heat Map' | 'Analytics' | 'Devices' | 'Notes';
export type ConnectionMode = 'local' | 'cloud' | 'offline';
export type Role = 'owner' | 'worker' | 'technician' | 'admin';
export type ControlMode = 'full' | 'monitor';
export type Condition = 'good' | 'watch' | 'urgent' | 'unavailable';
export type MetricKey = 'temperature' | 'humidity' | 'ammonia' | 'co2' | 'moisture';
export type Section = 'A' | 'B' | 'C';

export interface Sensor {
  id: string;
  number: string;
  section: Section;
  x: number;
  y: number;
  online: boolean;
  control: boolean;
  battery: number | null;
  signal: 'strong' | 'ok' | 'weak';
  readings: Record<MetricKey, number>;
  conditions: Record<MetricKey, Condition>;
}

export interface FarmAlert {
  id: string;
  titleKey: 'heatAlert' | 'sensorAlert' | 'resolvedAlert';
  section: Section;
  severity: 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  detectedAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  metric: MetricKey | null;
  sensorId: string;
  action: 'control_high' | 'none';
}

export interface ControlRequest {
  id: string;
  requestedAt: number;
  expiresAt: number;
  status: 'pending' | 'applied' | 'expired' | 'rejected';
  appliedAt?: number;
  overrideExpiresAt?: number;
}

export interface FarmSnapshot {
  sampledAt: number;
  syncedAt: number;
  sensors: Sensor[];
  alerts: FarmAlert[];
  request: ControlRequest | null;
  fanStage: 'high' | 'full';
}

export interface PreviewContext {
  connection: ConnectionMode;
  role: Role;
  controlMode: ControlMode;
}

/** UI data is supplied by an adapter. Production policies must also run on hub/node. */
export interface FarmService {
  getSnapshot(): Promise<FarmSnapshot>;
  acknowledge(id: string, context: PreviewContext): Promise<FarmSnapshot>;
  requestFullPower(context: PreviewContext): Promise<FarmSnapshot>;
  simulateReconnect(context: PreviewContext): Promise<FarmSnapshot>;
  tick(): FarmSnapshot;
}
