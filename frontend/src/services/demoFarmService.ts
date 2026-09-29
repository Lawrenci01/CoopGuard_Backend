import { createDemoSnapshot } from '../data/fixtures';
import { canRequestControl, DEMO_REQUEST_TTL_MS, settleRequest } from '../domain/policy';
import type { FarmService, FarmSnapshot, PreviewContext } from '../domain/types';

/** In-memory preview adapter. Makes no network or equipment calls. */
export class DemoFarmService implements FarmService {
  private snapshot: FarmSnapshot;
  private sequence = 0;
  constructor(private clock = () => Date.now()) {
    this.snapshot = createDemoSnapshot(clock());
  }
  private copy(): FarmSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot));
  }
  async getSnapshot() {
    return this.copy();
  }
  async acknowledge(id: string, context: PreviewContext) {
    if (context.connection === 'offline') throw new Error('offline');
    // Cloud acknowledgement is disabled in this preview until account/sync semantics exist.
    if (context.connection !== 'local') throw new Error('localRequired');
    this.snapshot.alerts = this.snapshot.alerts.map((alert) =>
      alert.id === id && alert.status === 'active'
        ? { ...alert, status: 'acknowledged', acknowledgedAt: this.clock() }
        : alert,
    );
    return this.copy();
  }
  async requestFullPower(context: PreviewContext) {
    if (!canRequestControl(context)) throw new Error('controlUnavailable');
    this.tick();
    if (
      this.snapshot.request?.status === 'pending' ||
      (this.snapshot.request?.status === 'applied' && this.snapshot.fanStage === 'full')
    )
      return this.copy();
    const now = this.clock();
    const request = settleRequest(
      {
        id: `demo-command-${++this.sequence}`,
        requestedAt: now,
        expiresAt: now + DEMO_REQUEST_TTL_MS,
        status: 'pending',
      },
      now,
      context,
    );
    this.snapshot.request = request;
    if (request.status === 'applied') this.snapshot.fanStage = 'full';
    return this.copy();
  }
  async simulateReconnect(context: PreviewContext) {
    if (this.snapshot.request)
      this.snapshot.request = settleRequest(this.snapshot.request, this.clock(), context);
    if (
      this.snapshot.request?.status === 'applied' &&
      this.snapshot.request.overrideExpiresAt! > this.clock()
    )
      this.snapshot.fanStage = 'full';
    this.snapshot.syncedAt = this.clock();
    return this.tick();
  }
  tick() {
    const request = this.snapshot.request;
    if (request?.status === 'pending' && this.clock() >= request.expiresAt)
      this.snapshot.request = { ...request, status: 'expired' };
    if (
      request?.status === 'applied' &&
      request.overrideExpiresAt &&
      this.clock() >= request.overrideExpiresAt
    )
      this.snapshot.fanStage = 'high';
    return this.copy();
  }
}
