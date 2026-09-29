import type { Condition, MetricKey, Sensor } from './types';

/** Summarize observations, without inventing thresholds or filling missing coverage. */
export function summarizeReadings(sensors: Sensor[], metric: MetricKey) {
  const reporting = sensors.filter(
    (sensor) => sensor.online && Number.isFinite(sensor.readings[metric]),
  );
  const value = reporting.length
    ? reporting.reduce((sum, sensor) => sum + sensor.readings[metric], 0) / reporting.length
    : null;
  const conditions = reporting.map((sensor) => sensor.conditions[metric]);
  const condition: Condition = conditions.includes('urgent')
    ? 'urgent'
    : conditions.includes('watch')
      ? 'watch'
      : reporting.length !== sensors.length ||
          !reporting.length ||
          conditions.includes('unavailable')
        ? 'unavailable'
        : 'good';
  return { value, condition, reporting: reporting.length, total: sensors.length };
}

export function formatReading(value: number | null, metric: MetricKey): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : value.toFixed(metric === 'temperature' || metric === 'ammonia' ? 1 : 0);
}
