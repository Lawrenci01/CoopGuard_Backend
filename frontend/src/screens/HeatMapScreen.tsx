import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Info } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import type { MetricKey, Sensor } from '../domain/types';
import { summarizeReadings, formatReading } from '../domain/readings';
import { metricUnits } from '../data/fixtures';
import { Card, Chip, Choice, Label, SectionTitle, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { FloorPlan } from '../components/FloorPlan';
import { SensorSheet } from '../components/FarmSheets';

export function HeatMapScreen() {
  const { snapshot } = useFarm();
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<MetricKey>('temperature'),
    [sensor, setSensor] = useState<Sensor | null>(null);
  return (
    <ScreenFrame tab="Heat Map">
      <Choice
        testPrefix="layer"
        values={['temperature', 'humidity', 'ammonia', 'co2', 'moisture']}
        selected={metric}
        labels={en.metrics}
        onSelect={setMetric}
      />
      <Card style={{ padding: width < 600 ? 16 : 28 }}>
        <SectionTitle title={en.floorPlan} subtitle={en.dimensions} />
        <FloorPlan sensors={snapshot.sensors} metric={metric} onSelect={setSensor} />
        <View style={[styles.row, { marginTop: 22, alignItems: 'flex-start' }]}>
          <Info size={15} color={colors.muted} />
          <Label style={{ flex: 1, color: colors.muted, fontSize: 12 }}>{en.mapHelp}</Label>
        </View>
      </Card>
      <View style={{ flexDirection: width < 600 ? 'column' : 'row', gap: 16 }}>
        {(['A', 'B', 'C'] as const).map((section) => {
          const sensors = snapshot.sensors.filter((s) => s.section === section);
          const summary = summarizeReadings(sensors, metric);
          return (
            <Card key={section} style={{ flex: 1, gap: 13 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Label weight="bold">
                  {en.section} {section}
                </Label>
                <Chip
                  tone={
                    summary.condition === 'watch'
                      ? 'amber'
                      : summary.condition === 'unavailable'
                        ? 'muted'
                        : 'green'
                  }
                >
                  {summary.condition === 'unavailable'
                    ? en.incompleteReadings
                    : en.statuses[summary.condition]}
                </Chip>
              </View>
              <Label weight="bold" style={{ fontSize: 30, lineHeight: 40 }}>
                {formatReading(summary.value, metric)}
                <Label style={{ color: colors.muted }}> {metricUnits[metric]}</Label>
              </Label>
              <Label style={{ color: colors.muted, fontSize: 12 }}>
                {summary.reporting} / {summary.total} {en.sensors.toLowerCase()} ·{' '}
                {en.online.toLowerCase()}
              </Label>
            </Card>
          );
        })}
      </View>
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
    </ScreenFrame>
  );
}
