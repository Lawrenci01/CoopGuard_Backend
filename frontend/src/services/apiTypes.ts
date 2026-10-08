import type { Role } from '../domain/types';
import type { LocalFarmState } from './localFarmRepository';

export interface Account {
  id: string;
  username: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}
export interface FarmAccess {
  id: string;
  name: string;
  code: string;
}
export interface Identity {
  account: Account;
  farms: FarmAccess[];
}
export interface Session extends Identity {
  token: string;
  expiresAt: number;
}
export interface FarmResponse {
  state: LocalFarmState;
  revision: number;
  readings?: 'sample' | 'simulated' | 'hardware';
}
export interface WorkerAccount {
  id: string;
  username: string;
  name: string;
  active: boolean;
  mustChangePassword: boolean;
}
export interface AdminFarmInput {
  farmName: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  address: string;
  ownerUsername: string;
  ownerName: string;
}
export interface AdminFarmResult {
  farmId: string;
  farmCode: string;
  qr: string;
  owner: { username: string; name: string; password: string };
}
export interface HubClaimResult {
  status: 'claimed' | 'replacement_pending';
  hubId: string;
  server: string;
  message: string;
  requestId?: string;
}
export interface HubReplacementRequest {
  id: string;
  farmId: string;
  farmName: string;
  farmCode: string;
  oldHubId: string;
  newHubId: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}
export type ReadingSource = 'simulated' | 'hardware';
export interface TelemetryNodeDevice {
  nodeId: string;
  number: string;
  section: string;
  x: number;
  y: number;
  control: boolean;
  source: ReadingSource;
  sampledAt: number | null;
  receivedAt: number | null;
  sequence: number | null;
  firmwareVersion: string | null;
  batteryPercent: number | null;
  rssiDbm: number | null;
  readings: Record<'temperature' | 'humidity' | 'ammonia' | 'co2' | 'moisture', number> | null;
}
export interface FarmDevices {
  hub: {
    id: string;
    farmId: string;
    source: ReadingSource;
    createdAt: number;
    lastSeenAt: number | null;
  } | null;
  nodes: TelemetryNodeDevice[];
}
export interface AdminFarmSummary {
  id: string;
  name: string;
  code: string;
  customerName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  hubId: string | null;
  hubSource: ReadingSource | null;
  hubLastSeenAt: number | null;
  nodeCount: number;
  latest: TelemetryNodeDevice | null;
}
