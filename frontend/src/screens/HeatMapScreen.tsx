import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import type { MetricKey, Sensor } from '../domain/types';
import { Label } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { FloorPlan } from '../components/FloorPlan';
import { SensorSheet } from '../components/FarmSheets';
import { enabledMetrics } from '../domain/siteWorkflow';

export function HeatMapScreen() {
  const { snapshot, data, readingSource } = useFarm();
  const [selectedMetric, setMetric] = useState<MetricKey>('temperature');
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const metrics = enabledMetrics(data.site);
  const house = data.site.survey?.house ?? data.house;
  const metric = metrics.includes(selectedMetric) ? selectedMetric : metrics[0]!;
  const reporting = snapshot.sensors.filter((item) => item.online).length;
  return (
    <ScreenFrame
      tab="Heat Map"
      subtitle={`${readingSource === 'hardware' ? 'Hardware' : readingSource === 'simulated' ? 'Simulated' : 'Sample'} node locations ${String.fromCharCode(
        183,
      )} ${reporting} of ${snapshot.sensors.length} reporting`}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {metrics.map((value) => {
          const active = value === metric;
          return (
            <Pressable
              key={value}
              testID={`layer-${value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setMetric(value)}
              style={({ pressed }) => ({
                width: '31.5%',
                minHeight: 38,
                paddingHorizontal: 6,
                borderWidth: 1,
                borderColor: active ? colors.green : colors.border,
                borderRadius: 10,
                backgroundColor: active ? colors.green : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Label
                weight="bold"
                style={{
                  color: active ? '#FFFFFF' : colors.text,
                  fontSize: 9,
                  textAlign: 'center',
                }}
              >
                {en.metrics[value]}
              </Label>
            </Pressable>
          );
        })}
      </View>
      <FloorPlan
        sensors={snapshot.sensors}
        metric={metric}
        onSelect={setSensor}
        lengthMetres={house?.lengthMetres ?? 90}
        widthMetres={house?.widthMetres ?? 12}
      />
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
    </ScreenFrame>
  );
}
