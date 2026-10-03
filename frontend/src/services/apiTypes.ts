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
  technicianUsername: string;
  technicianName: string;
}
export interface AdminFarmResult {
  farmId: string;
  farmCode: string;
  qr: string;
  owner: { username: string; name: string; password: string };
  technician: { username: string; name: string; created: boolean; password?: string };
}
