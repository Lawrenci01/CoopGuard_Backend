import type { Role } from "./shared/domain/types";
import type { LocalFarmState } from "./shared/services/localFarmRepository";

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
