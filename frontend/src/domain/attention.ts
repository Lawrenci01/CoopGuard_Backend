import type { FarmSnapshot, MetricKey } from './types';
import { summarizeReadings } from './readings';

/** Acknowledgment is not resolution. Incomplete coverage must not become an all-clear. */
export function houseAttention(snapshot: FarmSnapshot) {
  const alerts = snapshot.alerts
    .filter((a) => a.status !== 'resolved')
    .sort(
      (a, b) =>
        Number(b.severity === 'warning') - Number(a.severity === 'warning') ||
        b.detectedAt - a.detectedAt,
    );
  if (alerts[0]?.severity === 'warning')
    return { kind: 'alert' as const, alert: alerts[0], count: alerts.length };
  const metrics: MetricKey[] = ['temperature', 'humidity', 'ammonia', 'co2', 'moisture'];
  const summaries = metrics.map((metric) => ({
    metric,
    ...summarizeReadings(snapshot.sensors, metric),
  }));
  const urgent = summaries.find((s) => s.condition === 'urgent');
  if (urgent) return { kind: 'reading' as const, metric: urgent.metric };
  if (alerts[0]) return { kind: 'alert' as const, alert: alerts[0], count: alerts.length };
  const watch = summaries.find((s) => s.condition === 'watch');
  if (watch) return { kind: 'reading' as const, metric: watch.metric };
  if (summaries.some((s) => s.condition === 'unavailable')) return { kind: 'incomplete' as const };
  return { kind: 'clear' as const };
}
