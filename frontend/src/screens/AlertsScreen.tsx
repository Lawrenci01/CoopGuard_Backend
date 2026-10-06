import { useState } from 'react';
import { View } from 'react-native';
import { Check, Info, TriangleAlert } from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { canRequestControl } from '../domain/policy';
import type { Sensor } from '../domain/types';
import { Button, Card, Chip, Choice, Label, Sheet, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { ControlSheet, RequestStatus, SensorSheet } from '../components/FarmSheets';

export function AlertsScreen() {
  const { snapshot, context, now, acknowledge, data } = useFarm();
  const [filter, setFilter] = useState('active'),
    [detailId, setDetailId] = useState<string | null>(null);
  const [sensor, setSensor] = useState<Sensor | null>(null),
    [confirm, setConfirm] = useState(false);
  const detail = snapshot.alerts.find((a) => a.id === detailId);
  const alerts = snapshot.alerts.filter(
    (a) =>
      filter === 'all' || (filter === 'active' ? a.status !== 'resolved' : a.status === 'resolved'),
  );
  return (
    <ScreenFrame
      tab="Alerts"
      action={
        <Chip tone="amber">
          {snapshot.alerts.filter((a) => a.status !== 'resolved').length} open
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
        <Card key={alert.id} style={{ padding: 18, gap: 12 }}>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            {alert.severity === 'warning' ? (
              <TriangleAlert size={21} color={colors.amber} />
            ) : (
              <Info size={21} color={colors.blue} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Label weight="bold" style={{ fontSize: 18, lineHeight: 24 }}>
                {en[alert.titleKey]}
              </Label>
              <Label style={{ color: colors.muted, fontSize: 11 }}>
                {en.section} {alert.section} · {relativeTime(alert.detectedAt, now)}
                {alert.status === 'resolved' ? ' · Resolved' : ''}
              </Label>
            </View>
          </View>
          <Label>
            {alert.titleKey === 'heatAlert'
              ? `Check the fans and airflow in Section ${alert.section}.`
              : alert.titleKey === 'sensorAlert'
                ? 'Check the sensor’s power and position.'
                : alert.titleKey === 'sensorCheckAlert'
                  ? 'Wait for warm-up or ask a technician to check calibration and sensor validity.'
                  : 'The reported condition returned to its usual range.'}
          </Label>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {alert.status !== 'resolved' && (
              <Button
                testID={`ack-${alert.id}`}
                compact
                icon={Check}
                variant="secondary"
                disabled={alert.status === 'acknowledged' || context.connection !== 'local'}
                onPress={() => acknowledge(alert.id)}
              >
                {alert.status === 'acknowledged' ? en.acknowledged : en.gotIt}
              </Button>
            )}
            <Button
              testID={`alert-details-${alert.id}`}
              compact
              variant="ghost"
              onPress={() => setDetailId(alert.id)}
            >
              Details
            </Button>
          </View>
        </Card>
      ))}
      {context.connection !== 'local' && (
        <Label style={{ fontSize: 12, color: colors.muted }}>
          {context.connection === 'offline' ? en.offlineAction : en.localAck}
        </Label>
      )}
      <Sheet
        visible={!!detail}
        title={detail ? en[detail.titleKey] : ''}
        onClose={() => setDetailId(null)}
      >
        {detail && (
          <View style={{ gap: 16 }}>
            <Label>
              {detail.titleKey === 'heatAlert'
                ? en.heatWhy
                : detail.titleKey === 'sensorAlert'
                  ? en.sensorWhy
                  : detail.titleKey === 'sensorCheckAlert'
                    ? en.sensorCheckWhy
                    : en.resolvedWhy}
            </Label>
            {detail.status === 'acknowledged' && (
              <Label>
                You have seen this alert. It remains open until the condition is resolved.
              </Label>
            )}
            {detail.action === 'control_high' && (
              <>
                <Label weight="bold">
                  {context.controlMode === 'monitor' ? en.monitorAction : en.controlHigh}
                </Label>
                {context.controlMode === 'full' && (
                  <Label style={{ color: colors.muted }}>{en.feedbackNote}</Label>
                )}
                {context.controlMode === 'full' && detail.status !== 'resolved' && (
                  <Button
                    disabled={
                      !canRequestControl(context) ||
                      snapshot.request?.status === 'pending' ||
                      snapshot.fanStage === 'full'
                    }
                    onPress={() => {
                      setDetailId(null);
                      setConfirm(true);
                    }}
                  >
                    {en.fullPower}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="secondary"
              onPress={() => {
                setSensor(
                  [...snapshot.sensors, ...data.retired].find((s) => s.id === detail.sensorId) ??
                    null,
                );
                setDetailId(null);
              }}
            >
              {en.seeReadings}
            </Button>
          </View>
        )}
      </Sheet>
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
      <ControlSheet visible={confirm} onClose={() => setConfirm(false)} />
    </ScreenFrame>
  );
}
