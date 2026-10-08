import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  CheckCircle2,
  ChevronRight,
  Droplets,
  Info,
  Leaf,
  Thermometer,
  TriangleAlert,
  Wind,
} from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { useAuth } from '../state/AuthProvider';
import { Button, Card, Chip, Label, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { Equipment } from '../components/Equipment';
import { FlockManager } from '../components/FarmManagement';
import { metricUnits } from '../data/fixtures';
import { formatReading, summarizeReadings } from '../domain/readings';
import { houseAttention } from '../domain/attention';
import type { MetricKey, TabName } from '../domain/types';
import { roleHomeTitle } from '../domain/roles';
import { enabledMetrics } from '../domain/siteWorkflow';
import { houseGrid, sectionIndex } from '../domain/houseLayout';

const metricIcon = (metric: MetricKey) =>
  metric === 'temperature' ? Thermometer : metric === 'humidity' ? Droplets : Wind;

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<Record<TabName, undefined>>>();
  const auth = useAuth();
  const { snapshot, context, now, data } = useFarm();
  const house = data.site.survey?.house ?? data.house;
  const layout = houseGrid(house?.lengthMetres ?? 90, house?.widthMetres ?? 12);
  const attention = houseAttention(snapshot);
  const clear = attention.kind === 'clear';
  const informational = attention.kind === 'unclassified';
  const needsAttention = !clear && !informational;
  const title =
    attention.kind === 'alert'
      ? en[attention.alert.titleKey]
      : attention.kind === 'reading'
        ? `Check ${en.metrics[attention.metric].toLowerCase()}`
        : attention.kind === 'incomplete'
          ? 'Some readings are missing'
          : attention.kind === 'unclassified'
            ? 'Live readings received'
            : 'No active issues reported';
  const body =
    attention.kind === 'alert'
      ? attention.alert.titleKey === 'heatAlert'
        ? `Temperature is above the reviewed target in Section ${attention.alert.section}.`
        : 'The latest node status needs a human check.'
      : attention.kind === 'reading'
        ? 'Open the house map to see where to check.'
        : attention.kind === 'incomplete'
          ? 'Check the sensors before relying on the house average.'
          : attention.kind === 'unclassified'
            ? 'These values are for observation until a technician approves the farm limits.'
            : 'Keep checking the house during your usual rounds.';
  const reporting = snapshot.sensors.filter((sensor) => sensor.online).length;
  const overviewMetrics = enabledMetrics(data.site).slice(0, 2);
  const firstName = auth.record?.session.account.name.split(/\s+/)[0] ?? 'there';
  const attentionTime =
    attention.kind === 'alert' ? attention.alert.detectedAt : snapshot.sampledAt;

  return (
    <ScreenFrame tab="Dashboard" hideTitle>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
        ]}
      >
        <View>
          <Label style={{ color: colors.muted, fontSize: 11 }}>Good morning, {firstName}</Label>
          <Label
            accessibilityRole="header"
            weight="bold"
            style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }}
          >
            {roleHomeTitle[context.role]}
          </Label>
        </View>
      </View>

      <Card
        testID="house-attention"
        style={{
          gap: 10,
          padding: 16,
          marginBottom: 7,
          backgroundColor: clear
            ? colors.greenSoft
            : informational
              ? colors.blueSoft
              : colors.amberSoft,
          borderColor: clear ? '#CFE2D4' : informational ? '#C9DFEE' : '#EDD39B',
        }}
      >
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Chip tone={clear ? 'green' : informational ? 'blue' : 'amber'}>
            {clear ? 'Clear' : informational ? 'Monitoring' : 'Attention'}
          </Chip>
          <Label style={{ color: colors.muted, fontSize: 9 }}>
            Updated {relativeTime(attentionTime, now).toLowerCase()}
          </Label>
        </View>
        <View style={styles.row}>
          {clear ? (
            <CheckCircle2 size={20} color={colors.green} />
          ) : informational ? (
            <Info size={20} color={colors.blue} />
          ) : (
            <TriangleAlert size={20} color={colors.amber} />
          )}
          <Label weight="bold" style={{ flex: 1, fontSize: 19, lineHeight: 25 }}>
            {title}
          </Label>
        </View>
        <Label style={{ color: informational ? '#4C6675' : colors.muted, fontSize: 11 }}>
          {body}
        </Label>
        {needsAttention && (
          <Pressable
            testID="overview-attention-action"
            accessibilityRole="button"
            onPress={() => navigation.navigate(attention.kind === 'alert' ? 'Alerts' : 'Heat Map')}
            style={{
              minHeight: 45,
              marginTop: 2,
              paddingTop: 11,
              borderTopWidth: 1,
              borderColor: '#EAD7AA',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Wind size={17} color={colors.amber} />
            <Label weight="bold" style={{ flex: 1, color: '#795910', fontSize: 10 }}>
              Inspect fans and airflow
            </Label>
            <ChevronRight size={17} color={colors.amber} />
          </Pressable>
        )}
      </Card>

      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
        <View>
          <Label weight="bold" style={{ fontSize: 16 }}>
            House readings
          </Label>
          <Label
            style={{
              color: colors.muted,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Whole house average {'\u00B7'} {relativeTime(snapshot.sampledAt, now)}
          </Label>
        </View>
        <Chip tone={reporting === snapshot.sensors.length ? 'green' : 'amber'}>
          {reporting} of {snapshot.sensors.length} nodes
        </Chip>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {overviewMetrics.map((metric) => {
          const summary = summarizeReadings(snapshot.sensors, metric);
          const MetricIcon = metricIcon(metric);
          return (
            <Card key={metric} style={{ flex: 1, padding: 15 }}>
              <View style={[styles.row, { gap: 7 }]}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: colors.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MetricIcon size={17} color={colors.green} strokeWidth={1.8} />
                </View>
                <Label weight="bold" style={{ flex: 1, fontSize: 10 }}>
                  {en.metrics[metric]}
                </Label>
              </View>
              <Label
                weight="bold"
                style={{ fontSize: 30, lineHeight: 38, letterSpacing: -1.3, marginTop: 13 }}
              >
                {formatReading(summary.value, metric)}
                <Label weight="medium" style={{ fontSize: 13, color: colors.muted }}>
                  {' '}
                  {metricUnits[metric]}
                </Label>
              </Label>
              <Label style={{ color: colors.muted, fontSize: 8 }}>
                {summary.condition === 'unclassified'
                  ? 'Awaiting reviewed limits'
                  : en.statuses[summary.condition]}
              </Label>
            </Card>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View house map"
        onPress={() => navigation.navigate('Heat Map')}
        style={({ pressed }) => ({
          minHeight: 82,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View
          style={{
            width: 115,
            height: 56,
            borderWidth: 2,
            borderColor: '#B7C7BA',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {layout.sections.map((section) => {
            const index = sectionIndex(section);
            const column = index % layout.columns;
            const row = Math.floor(index / layout.columns);
            const summary = summarizeReadings(
              snapshot.sensors.filter((sensor) => sensor.section === section),
              'temperature',
            );
            const warm = summary.condition === 'watch' || summary.condition === 'urgent';
            return (
              <View
                key={section}
                style={{
                  position: 'absolute',
                  left: (column * 115) / layout.columns,
                  top: (row * 56) / layout.rows,
                  width: 115 / layout.columns,
                  height: 56 / layout.rows,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: warm ? '#FFF0D2' : '#E9F2EB',
                  borderRightWidth: column === layout.columns - 1 ? 0 : 1,
                  borderBottomWidth: row === layout.rows - 1 ? 0 : 1,
                  borderColor: colors.surface,
                }}
              >
                <Label
                  weight="bold"
                  style={{ color: warm ? colors.amber : colors.green, fontSize: 8 }}
                >
                  {section}
                </Label>
                <Label style={{ color: warm ? colors.amber : colors.green, fontSize: 7 }}>
                  {formatReading(summary.value, 'temperature')}
                  {'\u00B0'}
                </Label>
              </View>
            );
          })}
        </View>
        <View style={{ flex: 1 }}>
          <Label weight="bold" style={{ fontSize: 11 }}>
            View house map
          </Label>
          <Label style={{ color: colors.muted, fontSize: 8 }}>Installed node locations</Label>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>

      {(!data.site.survey || (data.site.plan?.equipment.length ?? 0) > 0) && (
        <>
          <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
            <View>
              <Label weight="bold" style={{ fontSize: 16 }}>
                Equipment
              </Label>
              <Label
                style={{
                  color: colors.muted,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Technician-approved devices
              </Label>
            </View>
            <Chip tone="amber">Simulated output</Chip>
          </View>
          <Equipment />
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => context.role === 'owner' && navigation.navigate('Analytics')}
        style={{
          minHeight: 58,
          borderTopWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 4,
        }}
      >
        <Leaf size={20} color={colors.green} />
        <View style={{ flex: 1 }}>
          <Label weight="bold" style={{ fontSize: 11 }}>
            Environmental insight
          </Label>
          <Label style={{ color: colors.muted, fontSize: 9 }}>
            Collecting data {'\u00B7'} No AI results yet
          </Label>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>

      {context.role === 'owner' && data.site.survey && !data.flock && <FlockManager nextStep />}
      {context.role === 'worker' && (
        <Button variant="secondary" onPress={() => navigation.navigate('Notes')}>
          Record an inspection
        </Button>
      )}
    </ScreenFrame>
  );
}
