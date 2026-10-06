import { useEffect, useState } from 'react';
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
import { useAuth } from '../state/AuthProvider';
import { enabledMetrics } from '../domain/siteWorkflow';
import { simulatedNodeTrend } from '../domain/readings';
import { api } from '../services/api';

export function AnalyticsScreen() {
  const { data, snapshot, readingSource } = useFarm();
  const auth = useAuth();
  const [selectedMetric, setMetric] = useState<MetricKey>('temperature'),
    [range, setRange] = useState('today');
  const [liveHistory, setLiveHistory] = useState<{ sampledAt: number; value: number }[]>([]);
  const metrics = enabledMetrics(data.site).filter(
    (value): value is Exclude<MetricKey, 'moisture'> => value !== 'moisture',
  );
  const metric = metrics.find((value) => value === selectedMetric) ?? metrics[0]!;
  const windowMs =
    range === 'today' ? 86_400_000 : range === 'week' ? 7 * 86_400_000 : 30 * 86_400_000;
  const sensorKey = snapshot.sensors
    .map((sensor) => sensor.id)
    .sort()
    .join(',');

  useEffect(() => {
    let active = true;
    if (readingSource !== 'telemetry' || !auth.record) {
      setLiveHistory([]);
      return () => {
        active = false;
      };
    }
    const end = Date.now();
    void Promise.all(
      snapshot.sensors.map((sensor) =>
        api.telemetryHistory(
          auth.server,
          auth.record!.session.token,
          auth.record!.farmId,
          sensor.id,
          metric,
          end - windowMs,
          end,
        ),
      ),
    )
      .then((responses) => {
        if (!active) return;
        const buckets = new Map<number, number[]>();
        for (const point of responses.flatMap((response) => response.points)) {
          const minute = Math.floor(point.sampledAt / 60_000) * 60_000;
          const values = buckets.get(minute) ?? [];
          values.push(point.value);
          buckets.set(minute, values);
        }
        setLiveHistory(
          [...buckets]
            .sort(([a], [b]) => a - b)
            .map(([sampledAt, values]) => ({
              sampledAt,
              value: values.reduce((sum, value) => sum + value, 0) / values.length,
            }))
            .slice(-40),
        );
      })
      .catch(() => {
        if (active) setLiveHistory([]);
      });
    return () => {
      active = false;
    };
  }, [auth.record, auth.server, metric, readingSource, sensorKey, windowMs]);

  const sampleSeries = simulatedNodeTrend(snapshot.sensors, metric, trendValues[metric]);
  const sampleRange =
    range === 'today'
      ? sampleSeries
      : range === 'week'
        ? sampleSeries.filter((_, index) => index % 3 === 0)
        : [...sampleSeries].reverse();
  const series =
    readingSource === 'telemetry' ? liveHistory.map((point) => point.value) : sampleRange;
  const labels =
    readingSource === 'telemetry'
      ? liveHistory.length > 1
        ? [
            new Date(liveHistory[0]!.sampledAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            }),
            new Date(liveHistory[liveHistory.length - 1]!.sampledAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            }),
          ]
        : ['First reading', 'More soon']
      : range === 'today'
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
                reporting nodes ·{' '}
                {readingSource === 'telemetry' ? 'stored telemetry' : 'simulated history'}
              </Label>
            </View>
            <View style={{ minHeight: 230 }}>
              <TrendChart values={series} labels={labels} />
            </View>
          </>
        ) : (
          <Label style={{ paddingVertical: 24, color: colors.muted }}>
            {readingSource === 'telemetry'
              ? 'Live history will appear as node readings are stored.'
              : 'No node readings are available for this farm yet.'}
          </Label>
        )}
      </Card>
      <AIInsights />
    </ScreenFrame>
  );
}
