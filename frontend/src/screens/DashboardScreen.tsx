import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  ArrowRight,
  ArrowUpRight,
  Droplets,
  Fan,
  Flame,
  Lightbulb,
  Thermometer,
  Wind,
  Cloud,
  Leaf,
  ShieldCheck,
  Radio,
  TriangleAlert,
} from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Chip, Label, SectionTitle, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { BarnIllustration } from '../components/BarnIllustration';
import { TrendChart } from '../components/TrendChart';
import { FloorPlan } from '../components/FloorPlan';
import { ControlSheet, RequestStatus, SensorSheet } from '../components/FarmSheets';
import { metricUnits, trendValues } from '../data/fixtures';
import { canRequestControl } from '../domain/policy';
import { formatReading, summarizeReadings } from '../domain/readings';
import type { MetricKey, Sensor, TabName } from '../domain/types';

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<Record<TabName, undefined>>>();
  const { snapshot, context, now } = useFarm();
  const { width } = useWindowDimensions();
  const columns = width >= 1180;
  const [confirm, setConfirm] = useState(false),
    [sensor, setSensor] = useState<Sensor | null>(null);
  const metrics: { key: MetricKey; icon: typeof Thermometer }[] = [
    { key: 'temperature', icon: Thermometer },
    { key: 'humidity', icon: Droplets },
    { key: 'ammonia', icon: Wind },
    { key: 'co2', icon: Cloud },
  ];
  const requestActive = snapshot.request?.status === 'pending' || snapshot.fanStage === 'full';
  return (
    <ScreenFrame tab="Dashboard" action={<Chip dot>{en.flock}</Chip>}>
      <View style={{ flexDirection: columns ? 'row' : 'column', gap: 18 }}>
        <Card
          style={{
            flex: 1.9,
            backgroundColor: '#EAF0E1',
            borderColor: '#E0E8D5',
            padding: 26,
            minHeight: 217,
            overflow: 'hidden',
          }}
        >
          <View style={{ maxWidth: width > 600 ? '65%' : '100%', gap: 13, zIndex: 1 }}>
            <Chip tone="green">
              <Leaf size={11} color={colors.green} /> {en.conditions}
            </Chip>
            <Label
              weight="bold"
              style={{ fontSize: 25, lineHeight: 33, letterSpacing: -0.6, color: colors.ink }}
            >
              {en.houseSummary}
            </Label>
            <Label style={{ maxWidth: 325, fontSize: 13, lineHeight: 21, color: '#62745C' }}>
              {en.houseSummaryText}
            </Label>
            <Button
              compact
              variant="ghost"
              icon={ArrowUpRight}
              onPress={() => navigation.navigate('Heat Map')}
            >
              {en.viewMap}
            </Button>
          </View>
          {width > 600 && (
            <View style={{ position: 'absolute', right: -8, bottom: 0, width: '44%', height: 190 }}>
              <BarnIllustration />
            </View>
          )}
        </Card>
        <Card style={{ flex: 1, backgroundColor: '#FFF9EF', borderColor: '#EDDFC5', gap: 12 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { gap: 6 }]}>
              <TriangleAlert size={16} color={colors.amber} />
              <Label weight="bold" style={{ color: colors.amber, fontSize: 11 }}>
                {en.attention}
              </Label>
            </View>
            <Label style={{ color: '#A3947E', fontSize: 10 }}>
              {relativeTime(snapshot.alerts[0]!.detectedAt, now)}
            </Label>
          </View>
          <Label weight="bold" style={{ fontSize: 18, lineHeight: 25 }}>
            {en.heatAlert}
          </Label>
          <View style={styles.row}>
            <Label
              weight="bold"
              style={{ color: colors.amber, fontSize: 32, lineHeight: 40, letterSpacing: -1 }}
            >
              31.8<Label style={{ color: colors.amber, fontSize: 17 }}> °C</Label>
            </Label>
            <Chip tone="amber">{en.statuses.watch}</Chip>
          </View>
          <Button
            variant="ghost"
            compact
            icon={ArrowRight}
            onPress={() => navigation.navigate('Alerts')}
          >
            {en.viewAlerts}
          </Button>
        </Card>
      </View>
      <View>
        <SectionTitle title={en.conditions} subtitle={en.conditionsNote} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {metrics.map(({ key, icon: Icon }) => {
            const summary = summarizeReadings(snapshot.sensors, key);
            const watch = summary.condition === 'watch';
            return (
              <Card
                key={key}
                style={{
                  flexBasis: columns ? 0 : width < 380 ? '100%' : '45%',
                  flexGrow: 1,
                  padding: width < 600 ? 16 : 19,
                  gap: 12,
                }}
              >
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <View
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: watch ? colors.amberSoft : colors.greenSoft,
                    }}
                  >
                    <Icon size={19} color={watch ? colors.amber : colors.green} strokeWidth={1.7} />
                  </View>
                  <Chip
                    tone={watch ? 'amber' : summary.condition === 'unavailable' ? 'muted' : 'green'}
                  >
                    {summary.condition === 'unavailable'
                      ? en.incompleteReadings
                      : en.statuses[summary.condition]}
                  </Chip>
                </View>
                <View>
                  <Label style={{ color: colors.muted, fontSize: 12 }}>{en.metrics[key]}</Label>
                  <Label
                    weight="bold"
                    style={{ fontSize: 30, lineHeight: 39, color: colors.ink, letterSpacing: -1 }}
                  >
                    {formatReading(summary.value, key)}
                    <Label style={{ fontSize: 13, color: colors.muted }}> {metricUnits[key]}</Label>
                  </Label>
                </View>
                <TrendChart values={trendValues[key]} compact />
              </Card>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: columns ? 'row' : 'column', gap: 18 }}>
        <Card style={{ flex: 1.9 }}>
          <SectionTitle
            title={en.chartTitle}
            subtitle={en.chartSubtitle}
            action={en.chartView}
            onAction={() => navigation.navigate('Analytics')}
          />
          <View style={[styles.row, { marginBottom: 14 }]}>
            <Label weight="bold" style={{ color: colors.ink, fontSize: 27 }}>
              29.2°
            </Label>
            <Chip tone="muted">{en.sampleHistory}</Chip>
          </View>
          <TrendChart values={trendValues.temperature} />
        </Card>
        <Card style={{ flex: 1, gap: 15 }}>
          <SectionTitle title={en.controls} />
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <View style={{ padding: 10, backgroundColor: colors.greenSoft, borderRadius: 12 }}>
                <Fan size={24} color={colors.green} />
              </View>
              <View>
                <Label weight="bold">{en.fanSection}</Label>
                <Label style={{ color: colors.muted, fontSize: 11 }}>
                  {context.controlMode === 'monitor'
                    ? en.controlMode.monitor
                    : snapshot.fanStage === 'full'
                      ? en.override
                      : en.auto}
                </Label>
              </View>
            </View>
            <Label weight="bold" style={{ fontSize: 21 }}>
              {context.controlMode === 'monitor'
                ? '—'
                : snapshot.fanStage === 'full'
                  ? en.fanStageFull
                  : en.fanStageHigh}
            </Label>
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <Flame size={17} color={colors.muted} />
              <Label>{en.heater}</Label>
            </View>
            <Label style={{ color: colors.muted }}>
              {context.controlMode === 'monitor' ? '—' : en.heaterOff}
            </Label>
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <Lightbulb size={17} color={colors.muted} />
              <Label>{en.lights}</Label>
            </View>
            <Label>{context.controlMode === 'monitor' ? '—' : en.lightsOn}</Label>
          </View>
          <Label style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
            {context.controlMode === 'monitor' ? en.monitorNote : en.controlNote}
          </Label>
          {context.controlMode === 'full' && (
            <Button
              testID="full-power"
              disabled={!canRequestControl(context) || requestActive}
              onPress={() => setConfirm(true)}
              icon={ArrowUpRight}
            >
              {en.fullPower}
            </Button>
          )}
          <RequestStatus />
        </Card>
      </View>
      <View style={{ flexDirection: columns ? 'row' : 'column', gap: 18 }}>
        <Card style={{ flex: 1.9 }}>
          <SectionTitle
            title={en.floorPlan}
            subtitle={en.dimensions}
            action={en.viewMap}
            onAction={() => navigation.navigate('Heat Map')}
          />
          <FloorPlan sensors={snapshot.sensors} metric="temperature" onSelect={setSensor} compact />
        </Card>
        <Card style={{ flex: 1, gap: 15, backgroundColor: '#F0F3E9' }}>
          <Leaf size={25} color={colors.green} />
          <Label style={{ color: colors.muted, fontSize: 12 }}>{en.flies}</Label>
          <Label weight="bold" style={{ fontSize: 21 }}>
            {en.flyTitle}
          </Label>
          <Label style={{ color: colors.muted, lineHeight: 22 }}>{en.flyBody}</Label>
          <Chip tone="muted">{en.beta}</Chip>
        </Card>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <View style={styles.row}>
          <Radio size={16} color={colors.muted} />
          <Label style={{ color: colors.muted, fontSize: 12 }}>{en.sensorsReporting}</Label>
        </View>
        <View style={styles.row}>
          <ShieldCheck size={16} color={colors.green} />
          <Label style={{ color: colors.muted, fontSize: 12 }}>{en.hubPower}</Label>
        </View>
      </View>
      <ControlSheet visible={confirm} onClose={() => setConfirm(false)} />
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
    </ScreenFrame>
  );
}
