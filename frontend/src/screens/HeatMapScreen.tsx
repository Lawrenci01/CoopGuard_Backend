import { useState } from 'react';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import type { MetricKey, Sensor } from '../domain/types';
import { Card, Choice, Label } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { FloorPlan } from '../components/FloorPlan';
import { SensorSheet } from '../components/FarmSheets';
import { enabledMetrics } from '../domain/siteWorkflow';

export function HeatMapScreen() {
  const { snapshot, data, readingSource } = useFarm();
  const [selectedMetric, setMetric] = useState<MetricKey>('temperature'),
    [sensor, setSensor] = useState<Sensor | null>(null);
  const metrics = enabledMetrics(data.site);
  const metric = metrics.includes(selectedMetric) ? selectedMetric : metrics[0]!;
  return (
    <ScreenFrame tab="Heat Map">
      <Choice
        testPrefix="layer"
        values={metrics}
        selected={metric}
        labels={en.metrics}
        onSelect={setMetric}
      />
      <Card style={{ padding: 16, gap: 16 }}>
        <Label style={{ fontSize: 12, color: colors.muted }}>
          {readingSource === 'telemetry' ? 'Installed node locations' : 'Simulated node locations'}{' '}
          ? Tap a node for its readings.
        </Label>
        <FloorPlan sensors={snapshot.sensors} metric={metric} onSelect={setSensor} />
      </Card>
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
    </ScreenFrame>
  );
}
