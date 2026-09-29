import type { FarmSnapshot, MetricKey, Sensor } from '../domain/types';

const temperatures = [28.2, 28.6, 28.4, 28.8, 30.1, 31.8, 30.7, 31.1, 29.1, 28.8, 28.6, 29.2];

export function createDemoSnapshot(now = Date.now()): FarmSnapshot {
  const sensors: Sensor[] = temperatures.map((temperature, index) => ({
    id: `sensor-${String(index + 1).padStart(2, '0')}`,
    number: String(index + 1).padStart(2, '0'),
    section: index < 4 ? 'A' : index < 8 ? 'B' : 'C',
    x: 0.09 + Math.floor(index / 4) * 0.33 + (index % 2) * 0.16,
    y: index % 4 < 2 ? 0.28 : 0.73,
    online: index !== 10,
    control: index === 1 || index === 5 || index === 9,
    battery: index === 1 || index === 5 || index === 9 ? null : 68 + ((index * 7) % 29),
    signal: index === 10 ? 'weak' : index === 8 ? 'ok' : 'strong',
    readings: {
      temperature,
      humidity: 63 + (index % 5),
      ammonia: 5.2 + (index % 4) * 0.3,
      co2: 710 + index * 17,
      moisture: 23 + (index % 4),
    },
    // Demo statuses are fixtures, not production thresholds or client-side safety rules.
    conditions: {
      temperature: index >= 4 && index <= 7 ? 'watch' : 'good',
      humidity: 'good',
      ammonia: 'good',
      co2: 'good',
      moisture: 'good',
    },
  }));
  return {
    sampledAt: now,
    syncedAt: now - 25 * 60_000,
    sensors,
    fanStage: 'high',
    request: null,
    alerts: [
      {
        id: 'heat-b',
        titleKey: 'heatAlert',
        section: 'B',
        severity: 'warning',
        status: 'active',
        detectedAt: now - 4 * 60_000,
        metric: 'temperature',
        sensorId: 'sensor-06',
        action: 'control_high',
      },
      {
        id: 'sensor-c',
        titleKey: 'sensorAlert',
        section: 'C',
        severity: 'info',
        status: 'active',
        detectedAt: now - 12 * 60_000,
        metric: null,
        sensorId: 'sensor-11',
        action: 'none',
      },
      {
        id: 'humidity-a',
        titleKey: 'resolvedAlert',
        section: 'A',
        severity: 'info',
        status: 'resolved',
        detectedAt: now - 26 * 60 * 60_000,
        resolvedAt: now - 25 * 60 * 60_000,
        metric: 'humidity',
        sensorId: 'sensor-02',
        action: 'none',
      },
    ],
  };
}

export const metricUnits: Record<MetricKey, string> = {
  temperature: '°C',
  humidity: '%',
  ammonia: 'ppm',
  co2: 'ppm',
  moisture: '%',
};
export const trendValues: Record<MetricKey, number[]> = {
  temperature: [
    27.2, 27.4, 27.3, 27.1, 27.6, 28.3, 29.2, 30.1, 30.6, 30.1, 29.8, 30.2, 31.0, 30.5, 29.8, 29.5,
    29.7, 29.3, 29.1, 29.4, 29.0, 28.6, 28.8, 29.2,
  ],
  humidity: [
    66, 65, 64, 65, 64, 63, 62, 63, 65, 65, 64, 63, 64, 65, 66, 65, 64, 64, 63, 64, 65, 64, 65, 64,
  ],
  ammonia: [
    5.1, 5.2, 5.4, 5.2, 5.3, 5.5, 5.4, 5.6, 5.4, 5.5, 5.3, 5.2, 5.5, 5.4, 5.6, 5.3, 5.4, 5.2, 5.5,
    5.4, 5.5, 5.4, 5.3, 5.4,
  ],
  co2: [
    820, 815, 830, 800, 780, 790, 805, 810, 820, 800, 790, 810, 805, 790, 780, 785, 800, 810, 805,
    790, 795, 800, 810, 805,
  ],
  moisture: [
    25, 25, 24, 25, 26, 25, 24, 24, 25, 24, 23, 24, 24, 25, 24, 23, 24, 24, 24, 25, 24, 24, 23, 24,
  ],
};
