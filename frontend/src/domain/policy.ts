import type { ControlRequest, PreviewContext } from './types';

// Preview values only. The production remote request lifetime is still undecided.
export const DEMO_REQUEST_TTL_MS = 60_000;
export const OVERRIDE_DURATION_MS = 2 * 60 * 60 * 1000;

export function canRequestControl(context: PreviewContext): boolean {
  return context.controlMode === 'full' && context.connection !== 'offline';
}

export function canManageSensors(context: PreviewContext): boolean {
  return context.role === 'technician' && context.connection === 'local';
}

export function settleRequest(
  request: ControlRequest,
  now: number,
  context: PreviewContext,
): ControlRequest {
  if (request.status !== 'pending') return request;
  if (now >= request.expiresAt) return { ...request, status: 'expired' };
  if (context.controlMode !== 'full') return { ...request, status: 'rejected' };
  if (context.connection !== 'local') return request;
  return {
    ...request,
    status: 'applied',
    appliedAt: now,
    overrideExpiresAt: now + OVERRIDE_DURATION_MS,
  };
}
