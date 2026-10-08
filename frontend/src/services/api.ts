import type {
  AdminFarmInput,
  AdminFarmResult,
  Identity,
  Session,
  FarmResponse,
  WorkerAccount,
  HubClaimResult,
  HubReplacementRequest,
  FarmDevices,
  AdminFarmSummary,
} from './apiTypes';
import type { LocalAction, LocalFarmState } from './localFarmRepository';
import type { ConnectionMode } from '../domain/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface HealthResponse {
  service: string;
  version: string;
  readings: string;
  mode: 'cloud' | 'hub' | 'standalone';
  hubId?: string;
  sync?: { pendingOperations: number; lastPullAt: number; lastPushAt: number | null };
}
export interface TelemetryHistoryResponse {
  nodeId: string;
  metric: string;
  points: {
    id: string;
    nodeId: string;
    sampledAt: number;
    receivedAt: number;
    sequence: number;
    value: number;
    source: 'simulated' | 'hardware';
  }[];
}
export function normalizeServer(value: string) {
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Use the HTTPS server address supplied by the CoopGuard team.');
  return url.origin;
}
export function connectionModeForServer(server: string, connected: boolean): ConnectionMode {
  if (!connected) return 'offline';
  const hostname = new URL(normalizeServer(server)).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  )
    return 'local';
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return match && Number(match[1]) >= 16 && Number(match[1]) <= 31 ? 'local' : 'cloud';
}
export async function apiRequest<T>(
  server: string,
  path: string,
  token?: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${normalizeServer(server)}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof result.error === 'string'
          ? result.error.slice(0, 240)
          : 'The server could not complete the request.',
      );
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Cannot reach CoopGuard. Check this phone's connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
export const api = {
  health: (server: string) => apiRequest<HealthResponse>(server, '/health'),
  login: (server: string, username: string, password: string) =>
    apiRequest<Session>(server, '/v1/auth/login', undefined, { username, password }),
  me: (server: string, token: string) => apiRequest<Identity>(server, '/v1/me', token),
  password: (server: string, token: string, currentPassword: string, newPassword: string) =>
    apiRequest<Session>(server, '/v1/auth/password', token, { currentPassword, newPassword }),
  logout: (server: string, token: string) => apiRequest(server, '/v1/auth/logout', token, {}),
  farm: (server: string, token: string, farmId: string) =>
    apiRequest<FarmResponse>(server, `/v1/farms/${encodeURIComponent(farmId)}`, token),
  devices: (server: string, token: string, farmId: string) =>
    apiRequest<FarmDevices>(server, `/v1/farms/${encodeURIComponent(farmId)}/devices`, token),
  addNode: (server: string, token: string, farmId: string, section: string, nodeId?: string) =>
    apiRequest<{ hub: string; nodeId: string; section: string; source: 'simulated' }>(
      server,
      `/v1/farms/${encodeURIComponent(farmId)}/nodes`,
      token,
      { section, ...(nodeId ? { nodeId } : {}) },
    ),
  removeNode: (server: string, token: string, farmId: string, nodeId: string) =>
    apiRequest<{ ok: true }>(
      server,
      `/v1/farms/${encodeURIComponent(farmId)}/nodes/${encodeURIComponent(nodeId)}`,
      token,
      undefined,
      'DELETE',
    ),
  telemetryHistory: (
    server: string,
    token: string,
    farmId: string,
    nodeId: string,
    metric: string,
    from: number,
    to: number,
    bucketMs?: number,
  ) =>
    apiRequest<TelemetryHistoryResponse>(
      server,
      `/v1/farms/${encodeURIComponent(farmId)}/telemetry/history?nodeId=${encodeURIComponent(nodeId)}&metric=${encodeURIComponent(metric)}&from=${from}&to=${to}&limit=240${bucketMs ? `&bucketMs=${bucketMs}` : ''}`,
      token,
    ),
  mutate: (
    server: string,
    token: string,
    farmId: string,
    key: string,
    revision: number,
    action: LocalAction,
  ) =>
    apiRequest<FarmResponse>(server, `/v1/farms/${encodeURIComponent(farmId)}/actions`, token, {
      key,
      revision,
      action,
    }),
  import: (server: string, token: string, farmId: string, state: LocalFarmState) =>
    apiRequest<FarmResponse>(
      server,
      `/v1/farms/${encodeURIComponent(farmId)}/import`,
      token,
      state,
    ),
  workers: (server: string, token: string, farmId: string) =>
    apiRequest<WorkerAccount[]>(server, `/v1/farms/${encodeURIComponent(farmId)}/workers`, token),
  adminCreateFarm: (server: string, token: string, details: AdminFarmInput) =>
    apiRequest<AdminFarmResult>(server, '/v1/admin/farms', token, details),
  adminFarms: (server: string, token: string) =>
    apiRequest<{ farms: AdminFarmSummary[] }>(server, '/v1/admin/farms', token),
  claimHub: (
    server: string,
    token: string,
    farmId: string,
    qr: string,
    transport: 'wifi' | 'usb',
  ) =>
    apiRequest<HubClaimResult>(server, '/v1/hubs/claim', token, {
      farmId,
      qr,
      transport,
    }),
  hubReplacements: (server: string, token: string) =>
    apiRequest<{ requests: HubReplacementRequest[] }>(server, '/v1/admin/hub-replacements', token),
  reviewHubReplacement: (
    server: string,
    token: string,
    id: string,
    decision: 'approve' | 'reject',
  ) =>
    apiRequest<{ status: 'approved' | 'rejected'; hubId?: string }>(
      server,
      `/v1/admin/hub-replacements/${encodeURIComponent(id)}/review`,
      token,
      { decision },
    ),
};
