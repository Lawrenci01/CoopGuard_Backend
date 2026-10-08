import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { trendValues, metricUnits } from '../data/fixtures';
import type { MetricKey } from '../domain/types';
import { Button, Card, Chip, Choice, Label, Sheet } from '../components/ui';
import { AIInsights } from '../components/AIInsights';
import { ScreenFrame } from '../components/ScreenFrame';
import { TrendChart, type TrendPoint } from '../components/TrendChart';
import { useFarm } from '../state/FarmProvider';
import { useAuth } from '../state/AuthProvider';
import { enabledMetrics } from '../domain/siteWorkflow';
import { simulatedNodeTrend } from '../domain/readings';
import { api } from '../services/api';

type HistoryRange = 'today' | 'week' | 'month';

const DAY = 86_400_000;
const rangeDuration: Record<HistoryRange, number> = {
  today: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
};
const rangeBucket: Record<HistoryRange, number> = {
  today: 30 * 60_000,
  week: 3 * 60 * 60_000,
  month: 12 * 60 * 60_000,
};

const shortDate = (value: number) =>
  new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

function periodLabel(range: HistoryRange, from: number, to: number, latest: boolean) {
  if (range === 'today' && latest) return 'Today';
  if (range === 'today')
    return new Date(from).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  return `${shortDate(from)} – ${shortDate(to)}`;
}

function axisTime(range: HistoryRange, sampledAt: number) {
  return range === 'today'
    ? new Date(sampledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : range === 'week'
      ? new Date(sampledAt).toLocaleDateString([], { weekday: 'short' })
      : shortDate(sampledAt);
}

export function AnalyticsScreen() {
  const { data, snapshot, readingSource } = useFarm();
  const auth = useAuth();
  const [selectedMetric, setMetric] = useState<MetricKey>('temperature');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [nodePicker, setNodePicker] = useState(false);
  const [range, setRange] = useState<HistoryRange>('today');
  const [anchorTime, setAnchorTime] = useState(() => Date.now());
  const [periodOffset, setPeriodOffset] = useState(0);
  const [liveHistory, setLiveHistory] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const metrics = enabledMetrics(data.site);
  const metric = metrics.find((value) => value === selectedMetric) ?? metrics[0]!;
  const effectiveNodeFilter =
    nodeFilter === 'all' || snapshot.sensors.some((sensor) => sensor.id === nodeFilter)
      ? nodeFilter
      : 'all';
  const selectedSensors = useMemo(
    () =>
      effectiveNodeFilter === 'all'
        ? snapshot.sensors
        : snapshot.sensors.filter((sensor) => sensor.id === effectiveNodeFilter),
    [effectiveNodeFilter, snapshot.sensors],
  );
  const selectedNodeLabel =
    effectiveNodeFilter === 'all'
      ? 'Whole house average'
      : selectedSensors[0]?.number
        ? `Node ${selectedSensors[0].number} · Section ${selectedSensors[0].section}`
        : effectiveNodeFilter;
  const windowMs = rangeDuration[range];
  const bucketMs = rangeBucket[range];
  const windowEnd = anchorTime + periodOffset * windowMs;
  const windowStart = windowEnd - windowMs;
  const latestPeriod = periodOffset === 0;
  const sensorKey = snapshot.sensors
    .map((sensor) => sensor.id)
    .sort()
    .join(',');

  useEffect(() => {
    let active = true;
    if (readingSource === 'sample' || !auth.record) {
      setLiveHistory([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    void Promise.all(
      selectedSensors.map((sensor) =>
        api.telemetryHistory(
          auth.server,
          auth.record!.session.token,
          auth.record!.farmId,
          sensor.id,
          metric,
          windowStart,
          windowEnd,
          bucketMs,
        ),
      ),
    )
      .then((responses) => {
        if (!active) return;
        const buckets = new Map<number, number[]>();
        for (const point of responses.flatMap((response) => response.points)) {
          const bucket = Math.floor(point.sampledAt / bucketMs) * bucketMs;
          const values = buckets.get(bucket) ?? [];
          values.push(point.value);
          buckets.set(bucket, values);
        }
        setLiveHistory(
          [...buckets]
            .sort(([a], [b]) => a - b)
            .map(([sampledAt, values]) => ({
              sampledAt,
              value: values.reduce((sum, value) => sum + value, 0) / values.length,
            })),
        );
      })
      .catch(() => {
        if (active) setLiveHistory([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    auth.record,
    auth.server,
    bucketMs,
    metric,
    readingSource,
    sensorKey,
    windowEnd,
    windowStart,
    snapshot.sensors,
    nodeFilter,
  ]);

  const points = useMemo(() => {
    if (readingSource !== 'sample') return liveHistory;
    const values = simulatedNodeTrend(selectedSensors, metric, trendValues[metric]);
    return values.map((value, index) => ({
      value,
      sampledAt: windowStart + (index / Math.max(values.length - 1, 1)) * (windowEnd - windowStart),
    }));
  }, [liveHistory, metric, readingSource, selectedSensors, windowEnd, windowStart]);

  const precision = metric === 'temperature' || metric === 'ammonia' ? 1 : 0;
  const values = points.map((point) => point.value);
  const latest = values[values.length - 1];
  const low = values.length ? Math.min(...values) : null;
  const high = values.length ? Math.max(...values) : null;
  const average = values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
  const labelIndexes = points.length
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
    : [];
  const axisLabels = labelIndexes.map((index) => axisTime(range, points[index]!.sampledAt));
  const exactTimestamp = (sampledAt: number) =>
    new Date(sampledAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const selectRange = (value: HistoryRange) => {
    setRange(value);
    setAnchorTime(Date.now());
    setPeriodOffset(0);
  };

  return (
    <ScreenFrame tab="Analytics" subtitle="Whole-house environmental history">
      <Card style={{ gap: 18, padding: 18 }}>
        <View style={{ gap: 7 }}>
          <Label style={{ color: colors.muted, fontSize: 10, textTransform: 'uppercase' }}>
            Time range
          </Label>
          <Choice
            values={['today', 'week', 'month']}
            selected={range}
            labels={{
              today: en.today,
              week: '7 days',
              month: '30 days',
            }}
            onSelect={selectRange}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Label weight="bold" style={{ fontSize: 19, lineHeight: 25 }}>
              Environmental trend
            </Label>
            <Label style={{ color: colors.muted, fontSize: 11 }}>
              {effectiveNodeFilter === 'all'
                ? `Average across ${snapshot.sensors.filter((sensor) => sensor.online).length} reporting nodes`
                : `Readings for ${selectedSensors[0]?.number ? `Node ${selectedSensors[0].number}` : nodeFilter}`}
            </Label>
          </View>
          <Chip
            tone={
              readingSource === 'hardware'
                ? 'green'
                : readingSource === 'simulated'
                  ? 'blue'
                  : 'muted'
            }
          >
            {readingSource === 'hardware'
              ? 'Hardware data'
              : readingSource === 'simulated'
                ? 'Stored simulation'
                : 'Sample preview'}
          </Chip>
        </View>

        <Choice values={metrics} selected={metric} labels={en.metrics} onSelect={setMetric} />

        {snapshot.sensors.length > 1 && (
          <View style={{ gap: 6 }}>
            <Label style={{ color: colors.muted, fontSize: 10 }}>Node filter</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Node filter, ${selectedNodeLabel}`}
              onPress={() => setNodePicker(true)}
              style={({ pressed }) => ({
                minHeight: 50,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 13,
                backgroundColor: pressed ? colors.greenSoft : colors.surface,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Label weight="bold">{selectedNodeLabel}</Label>
                <Label style={{ color: colors.muted, fontSize: 10 }}>
                  Tap to choose one node or the whole-house average
                </Label>
              </View>
              <ChevronDown size={19} color={colors.green} />
            </Pressable>
          </View>
        )}

        <View
          style={{
            borderRadius: 16,
            backgroundColor: colors.greenSoft,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Label style={{ color: colors.green, fontSize: 10, textTransform: 'uppercase' }}>
              Latest in this period
            </Label>
            <Label weight="bold" style={{ fontSize: 35, lineHeight: 43, color: colors.green }}>
              {latest === undefined ? '—' : latest.toFixed(precision)}
              <Label style={{ color: colors.green, fontSize: 15 }}> {metricUnits[metric]}</Label>
            </Label>
          </View>
          <Label style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>
            {periodLabel(range, windowStart, windowEnd, latestPeriod)}
          </Label>
        </View>

        {values.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['Average', average],
              ['Low', low],
              ['High', high],
            ].map(([label, value]) => (
              <View
                key={String(label)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 13,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  gap: 2,
                }}
              >
                <Label style={{ color: colors.muted, fontSize: 9 }}>{label}</Label>
                <Label weight="bold" style={{ fontSize: 14 }}>
                  {(value as number).toFixed(precision)} {metricUnits[metric]}
                </Label>
              </View>
            ))}
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Button
            compact
            variant="secondary"
            icon={ChevronLeft}
            onPress={() => setPeriodOffset((value) => value - 1)}
          >
            Older
          </Button>
          <Label weight="bold" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {periodLabel(range, windowStart, windowEnd, latestPeriod)}
          </Label>
          <Button
            compact
            variant="secondary"
            icon={ChevronRight}
            disabled={latestPeriod}
            onPress={() => setPeriodOffset((value) => Math.min(0, value + 1))}
          >
            Newer
          </Button>
        </View>

        {loading ? (
          <View style={{ minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.green} />
            <Label style={{ color: colors.muted }}>Loading stored readings…</Label>
          </View>
        ) : points.length ? (
          <TrendChart
            points={points}
            unit={metricUnits[metric]}
            precision={precision}
            axisLabels={axisLabels}
            formatTimestamp={exactTimestamp}
          />
        ) : (
          <View style={{ minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Label weight="bold">No readings in this period</Label>
            <Label style={{ color: colors.muted, textAlign: 'center' }}>
              Choose an older or newer period, or wait for the installed nodes to report.
            </Label>
          </View>
        )}
      </Card>
      <AIInsights />
      <Sheet visible={nodePicker} title="Select readings" onClose={() => setNodePicker(false)}>
        <View style={{ gap: 8 }}>
          {[
            { id: 'all', label: 'Whole house average', detail: 'Average of all reporting nodes' },
            ...snapshot.sensors.map((sensor) => ({
              id: sensor.id,
              label: `Node ${sensor.number}`,
              detail: `Section ${sensor.section} · ${sensor.online ? 'Reporting' : 'Offline'}`,
            })),
          ].map((option) => {
            const selected = option.id === effectiveNodeFilter;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setNodeFilter(option.id);
                  setNodePicker(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 58,
                  borderWidth: 1,
                  borderColor: selected ? colors.green : colors.border,
                  borderRadius: 13,
                  backgroundColor: selected || pressed ? colors.greenSoft : colors.surface,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Label weight="bold">{option.label}</Label>
                  <Label style={{ color: colors.muted, fontSize: 10 }}>{option.detail}</Label>
                </View>
                {selected && <Check size={19} color={colors.green} />}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </ScreenFrame>
  );
}
