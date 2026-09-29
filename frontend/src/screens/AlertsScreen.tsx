import { useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, Check, Fan, Info, TriangleAlert } from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { canRequestControl } from '../domain/policy';
import type { Sensor } from '../domain/types';
import { Button, Card, Chip, Choice, Label, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { ControlSheet, RequestStatus, SensorSheet } from '../components/FarmSheets';

export function AlertsScreen() {
  const { snapshot, context, now, acknowledge } = useFarm();
  const [filter, setFilter] = useState('active'),
    [sensor, setSensor] = useState<Sensor | null>(null),
    [confirm, setConfirm] = useState(false);
  const alerts = snapshot.alerts.filter(
    (alert) =>
      filter === 'all' ||
      (filter === 'active' ? alert.status !== 'resolved' : alert.status === 'resolved'),
  );
  return (
    <ScreenFrame
      tab="Alerts"
      action={
        <Chip tone="amber" dot>
          {snapshot.alerts.filter((a) => a.status !== 'resolved').length} {en.active.toLowerCase()}
        </Chip>
      }
    >
      <Choice
        values={['active', 'earlier', 'all']}
        selected={filter}
        labels={{ active: en.active, earlier: en.earlier, all: en.allAlerts }}
        onSelect={setFilter}
      />
      <RequestStatus />
      {alerts.length === 0 && (
        <Card>
          <Label weight="bold">{en.noAlerts}</Label>
          <Label>{en.noAlertsText}</Label>
        </Card>
      )}
      {alerts.map((alert) => (
        <Card key={alert.id} style={{ gap: 18 }}>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <View
              style={{
                padding: 13,
                backgroundColor: alert.severity === 'warning' ? colors.amberSoft : colors.blueSoft,
                borderRadius: 14,
              }}
            >
              {alert.severity === 'warning' ? (
                <TriangleAlert size={23} color={colors.amber} />
              ) : (
                <Info size={23} color={colors.blue} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.row, { flexWrap: 'wrap', marginBottom: 5 }]}>
                <Chip
                  tone={
                    alert.status === 'resolved'
                      ? 'green'
                      : alert.severity === 'warning'
                        ? 'amber'
                        : 'blue'
                  }
                >
                  {alert.status === 'resolved'
                    ? en.resolved
                    : alert.severity === 'warning'
                      ? en.warning
                      : en.info}
                </Chip>
                {alert.status === 'acknowledged' && <Chip tone="muted">{en.acknowledged}</Chip>}
                <Label style={{ color: colors.muted, fontSize: 11 }}>
                  {en.section} {alert.section} · {relativeTime(alert.detectedAt, now)}
                </Label>
              </View>
              <Label weight="bold" style={{ fontSize: 21, lineHeight: 28 }}>
                {en[alert.titleKey]}
              </Label>
            </View>
          </View>
          <Label style={{ maxWidth: 750, color: colors.muted }}>
            {alert.titleKey === 'heatAlert'
              ? en.heatWhy
              : alert.titleKey === 'sensorAlert'
                ? en.sensorWhy
                : en.resolvedWhy}
          </Label>
          {alert.action === 'control_high' && (
            <View
              style={{ backgroundColor: colors.greenSoft, borderRadius: 13, padding: 18, gap: 6 }}
            >
              <Label weight="medium" style={{ fontSize: 11, color: colors.green }}>
                {context.controlMode === 'monitor' ? en.why : en.actionTaken}
              </Label>
              <Label weight="bold">
                {context.controlMode === 'monitor' ? en.monitorAction : en.controlHigh}
              </Label>
              {context.controlMode === 'full' && (
                <Label style={{ fontSize: 12, color: colors.muted }}>{en.feedbackNote}</Label>
              )}
            </View>
          )}
          {alert.status !== 'resolved' && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Button
                  testID={`ack-${alert.id}`}
                  icon={Check}
                  disabled={alert.status === 'acknowledged' || context.connection !== 'local'}
                  variant="secondary"
                  onPress={() => acknowledge(alert.id)}
                >
                  {alert.status === 'acknowledged' ? en.acknowledged : en.gotIt}
                </Button>
                {alert.action === 'control_high' && context.controlMode === 'full' && (
                  <Button
                    icon={Fan}
                    disabled={
                      !canRequestControl(context) ||
                      snapshot.request?.status === 'pending' ||
                      snapshot.fanStage === 'full'
                    }
                    onPress={() => setConfirm(true)}
                  >
                    {en.fullPower}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={ArrowRight}
                  onPress={() =>
                    setSensor(snapshot.sensors.find((s) => s.id === alert.sensorId) ?? null)
                  }
                >
                  {en.seeReadings}
                </Button>
              </View>
              {context.connection !== 'local' && (
                <Label style={{ fontSize: 11, color: colors.muted }}>
                  {context.connection === 'offline' ? en.offlineAction : en.localAck}
                </Label>
              )}
            </View>
          )}
        </Card>
      ))}
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
      <ControlSheet visible={confirm} onClose={() => setConfirm(false)} />
    </ScreenFrame>
  );
}
