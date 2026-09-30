import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CalendarDays, CloudSun, TrendingUp } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { trendValues, metricUnits } from '../data/fixtures';
import type { MetricKey } from '../domain/types';
import { Card, Choice, Label, SectionTitle, styles } from '../components/ui';
import { AIInsights } from '../components/AIInsights';
import { ScreenFrame } from '../components/ScreenFrame';
import { TrendChart } from '../components/TrendChart';

export function AnalyticsScreen() {
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<MetricKey>('temperature'),
    [range, setRange] = useState('today');
  // These are deliberately example series, never a derived welfare or mortality score.
  const series =
    range === 'today'
      ? trendValues[metric]
      : range === 'week'
        ? trendValues[metric].filter((_, i) => i % 3 === 0)
        : [...trendValues[metric]].reverse();
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
        <SectionTitle title={en.historyTitle} subtitle={en.sampleHistory} />
        <Choice
          values={['temperature', 'humidity', 'ammonia', 'co2']}
          selected={metric}
          labels={en.metrics}
          onSelect={setMetric}
        />
        <View style={{ paddingVertical: 22 }}>
          <Label weight="bold" style={{ fontSize: 35, lineHeight: 44 }}>
            {series[series.length - 1]}
            <Label style={{ color: colors.muted }}> {metricUnits[metric]}</Label>
          </Label>
          <Label style={{ color: colors.muted, fontSize: 12 }}>
            {en.metrics[metric]} · {en.sampleHistory.toLowerCase()}
          </Label>
        </View>
        <View style={{ minHeight: 230 }}>
          <TrendChart values={series} labels={labels} />
        </View>
      </Card>
      <Card style={{ backgroundColor: colors.greenSoft }}>
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <TrendingUp color={colors.green} size={23} />
          <View style={{ flex: 1, gap: 6 }}>
            <Label weight="bold" style={{ fontSize: 18 }}>
              {en.trendSummary}
            </Label>
            <Label style={{ color: colors.muted }}>{en.trendBody}</Label>
          </View>
        </View>
      </Card>
      <View style={{ flexDirection: width > 1100 ? 'row' : 'column', gap: 18 }}>
        <Card style={{ flex: 1, gap: 14 }}>
          <CloudSun color={colors.amber} size={28} />
          <Label weight="bold" style={{ fontSize: 18 }}>
            {en.weather}
          </Label>
          <Label weight="medium">{en.weatherUnavailable}</Label>
          <Label style={{ color: colors.muted }}>{en.weatherBody}</Label>
        </Card>
        <Card style={{ flex: 1, gap: 14 }}>
          <CalendarDays color={colors.green} size={26} />
          <Label weight="bold" style={{ fontSize: 18 }}>
            {en.flockComparison}
          </Label>
          <Label weight="medium">{en.comparisonTitle}</Label>
          <Label style={{ color: colors.muted }}>{en.comparisonBody}</Label>
        </Card>
      </View>
      <AIInsights />
    </ScreenFrame>
  );
}
