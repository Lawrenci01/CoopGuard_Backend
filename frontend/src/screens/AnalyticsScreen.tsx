import { useState } from 'react';
import { View } from 'react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { trendValues, metricUnits } from '../data/fixtures';
import type { MetricKey } from '../domain/types';
import { Card, Choice, Label } from '../components/ui';
import { AIInsights } from '../components/AIInsights';
import { ScreenFrame } from '../components/ScreenFrame';
import { TrendChart } from '../components/TrendChart';
import { useFarm } from '../state/FarmProvider';
import { enabledMetrics } from '../domain/siteWorkflow';
import { simulatedNodeTrend } from '../domain/readings';

export function AnalyticsScreen() {
  const { data, snapshot } = useFarm();
  const [selectedMetric, setMetric] = useState<MetricKey>('temperature'),
    [range, setRange] = useState('today');
  const metrics = enabledMetrics(data.site).filter(
    (metric): metric is Exclude<MetricKey, 'moisture'> => metric !== 'moisture',
  );
  const metric = metrics.find((value) => value === selectedMetric) ?? metrics[0]!;
  const wholeHouseSeries = simulatedNodeTrend(snapshot.sensors, metric, trendValues[metric]);
  const series =
    range === 'today'
      ? wholeHouseSeries
      : range === 'week'
        ? wholeHouseSeries.filter((_, i) => i % 3 === 0)
        : [...wholeHouseSeries].reverse();
  const labels =
    range === 'today'
      ? en.chartLabels.today
      : range === 'week'
        ? en.chartLabels.week
        : en.chartLabels.month;
  return (
    <ScreenFrame
      tab="Analytics"
      action={
        <Choice
          values={['today', 'week', 'month']}
          selected={range}
          labels={{ today: en.today, week: en.week, month: en.month }}
          onSelect={setRange}
        />
      }
    >
      <Card>
        <Choice values={metrics} selected={metric} labels={en.metrics} onSelect={setMetric} />
        {series.length ? (
          <>
            <View style={{ paddingVertical: 14 }}>
              <Label weight="bold" style={{ fontSize: 35, lineHeight: 44 }}>
                {series[series.length - 1]!.toFixed(
                  metric === 'temperature' || metric === 'ammonia' ? 1 : 0,
                )}
                <Label style={{ color: colors.muted }}> {metricUnits[metric]}</Label>
              </Label>
              <Label style={{ color: colors.muted, fontSize: 12 }}>
                Whole-house average · {snapshot.sensors.filter((sensor) => sensor.online).length}{' '}
                reporting nodes · simulated history
              </Label>
            </View>
            <View style={{ minHeight: 230 }}>
              <TrendChart values={series} labels={labels} />
            </View>
          </>
        ) : (
          <Label style={{ paddingVertical: 24, color: colors.muted }}>
            No node readings are available for this farm yet.
          </Label>
        )}
      </Card>
      <AIInsights />
    </ScreenFrame>
  );
}
