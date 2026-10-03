import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Label, Sheet, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { Equipment } from '../components/Equipment';
import { FlockManager } from '../components/FarmManagement';
import { HouseSetupForm } from '../components/HouseSetupForm';
import { metricUnits } from '../data/fixtures';
import { formatReading, summarizeReadings } from '../domain/readings';
import { houseAttention } from '../domain/attention';
import type { TabName } from '../domain/types';
import { roleHomeTitle } from '../domain/roles';
import { enabledMetrics } from '../domain/siteWorkflow';

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<Record<TabName, undefined>>>();
  const { snapshot, context, now, data } = useFarm();
  const [setup, setSetup] = useState(false),
    [next, setNext] = useState(false);
  const attention = houseAttention(snapshot);
  const clear = attention.kind === 'clear';
  const title =
    attention.kind === 'alert'
      ? en[attention.alert.titleKey]
      : attention.kind === 'reading'
        ? `Check ${en.metrics[attention.metric].toLowerCase()}`
        : attention.kind === 'incomplete'
          ? 'Some readings are missing'
          : 'No active issues reported';
  const body =
    attention.kind === 'alert'
      ? attention.alert.titleKey === 'heatAlert'
        ? `Check the fans and airflow in Section ${attention.alert.section}.`
        : 'Check the sensor’s power and position.'
      : attention.kind === 'reading'
        ? 'Open the house map to see where to check.'
        : attention.kind === 'incomplete'
          ? 'Check the sensors before relying on the house average.'
          : 'Keep checking the house during your usual rounds.';
  const reporting = snapshot.sensors.filter((s) => s.online).length;
  const overviewMetrics = enabledMetrics(data.site).slice(0, 2);
  return (
    <ScreenFrame tab="Dashboard" title={roleHomeTitle[context.role]}>
      <Card
        testID="house-attention"
        style={{
          padding: 18,
          gap: 12,
          backgroundColor: clear ? colors.greenSoft : colors.amberSoft,
        }}
      >
        {!clear && (
          <Label weight="bold" style={{ fontSize: 12, color: colors.amber }}>
            Needs attention
          </Label>
        )}
        <View style={styles.row}>
          {clear ? (
            <CheckCircle2 size={21} color={colors.green} />
          ) : (
            <TriangleAlert size={21} color={colors.amber} />
          )}
          <Label weight="bold" style={{ flex: 1, fontSize: 20, lineHeight: 27 }}>
            {title}
          </Label>
        </View>
        <Label>{body}</Label>
        {!clear && (
          <Button
            testID="overview-attention-action"
            compact
            icon={ArrowRight}
            onPress={() => navigation.navigate(attention.kind === 'alert' ? 'Alerts' : 'Heat Map')}
          >
            {attention.kind === 'alert'
              ? `View ${attention.count > 1 ? `${attention.count} alerts` : 'alert'}`
              : 'Take a look'}
          </Button>
        )}
      </Card>
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Label weight="bold">House readings</Label>
          <Label style={{ color: colors.muted, fontSize: 11 }}>
            {context.connection === 'local' ? 'Recorded' : 'Saved'}{' '}
            {relativeTime(snapshot.sampledAt, now).toLowerCase()}
          </Label>
        </View>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {overviewMetrics.map((metric) => {
            const summary = summarizeReadings(snapshot.sensors, metric);
            return (
              <View key={metric} style={{ flex: 1, gap: 3 }}>
                <Label style={{ color: colors.muted, fontSize: 12 }}>{en.metrics[metric]}</Label>
                <Label weight="bold" style={{ fontSize: 29, lineHeight: 38 }}>
                  {formatReading(summary.value, metric)}
                  <Label style={{ fontSize: 15 }}> {metricUnits[metric]}</Label>
                </Label>
              </View>
            );
          })}
        </View>
        {reporting !== snapshot.sensors.length && (
          <Label style={{ color: colors.amber, fontSize: 12 }}>
            {reporting} of {snapshot.sensors.length} nodes reporting · partial coverage
          </Label>
        )}
        <Button compact variant="ghost" onPress={() => navigation.navigate('Heat Map')}>
          All readings & house map
        </Button>
      </Card>
      {(!data.site.survey || (data.site.plan?.equipment.length ?? 0) > 0) && <Equipment />}
      {context.role === 'owner' && data.site.survey && !data.flock && <FlockManager nextStep />}
      {context.role === 'worker' && (
        <Button variant="secondary" onPress={() => navigation.navigate('Notes')}>
          Record an inspection
        </Button>
      )}
      {context.role === 'technician' && (
        <Button variant="secondary" onPress={() => navigation.navigate('Devices')}>
          Sensors & maintenance
        </Button>
      )}
      {!data.site.survey && context.role === 'technician' ? (
        <Button testID="setup-from-home" variant="secondary" onPress={() => setSetup(true)}>
          Start site survey
        </Button>
      ) : !data.site.survey && context.role === 'owner' ? (
        <Card style={{ gap: 8 }}>
          <Label weight="bold">Site survey needed</Label>
          <Label>
            A CoopGuard technician will survey this house, record its equipment, and prepare the
            approved setup. You can add your flock after the survey is saved.
          </Label>
        </Card>
      ) : data.site.survey && context.role === 'technician' ? (
        <Button testID="setup-next-steps" compact variant="ghost" onPress={() => setNext(true)}>
          Survey & installation status
        </Button>
      ) : null}
      {setup && (
        <Sheet visible title={en.setupTitle} onClose={() => setSetup(false)}>
          <HouseSetupForm onDone={() => setSetup(false)} />
        </Sheet>
      )}
      <Sheet visible={next} title="Site survey saved" onClose={() => setNext(false)}>
        <View style={{ gap: 18 }}>
          <Label weight="bold">1. {data.site.survey?.farm.houseName} is recorded</Label>
          <Label>
            Your house details are saved to the farm server and kept on this phone. Readings and
            equipment responses are still samples.
          </Label>
          <Label weight="bold">2. Confirm the equipment plan</Label>
          <Label>
            Record the site findings, place sensors, and keep unverified equipment in monitor-only
            mode.
          </Label>
          <Label weight="bold">3. Complete installation checks</Label>
          <Label>
            A technician must pair the hub and sensors, check wiring, and calibrate them. Saving
            this form does not make the house live.
          </Label>
          <Button onPress={() => setNext(false)}>Got it</Button>
        </View>
      </Sheet>
    </ScreenFrame>
  );
}
