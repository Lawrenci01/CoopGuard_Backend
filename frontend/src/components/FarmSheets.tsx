import { useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, Check, Fan, ScanLine } from 'lucide-react-native';
import type { Section, Sensor } from '../domain/types';
import { canManageSensors } from '../domain/policy';
import { SensorEditor } from './FarmManagement';
import { en, countdown, relativeTime } from '../i18n/en';
import { metricUnits } from '../data/fixtures';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Chip, Choice, Label, Sheet, styles } from './ui';
import { enabledMetrics } from '../domain/siteWorkflow';
import { houseGrid } from '../domain/houseLayout';

export function SensorSheet({ sensor, onClose }: { sensor: Sensor | null; onClose: () => void }) {
  const { snapshot, now, context, data } = useFarm();
  return (
    <Sheet
      visible={!!sensor}
      onClose={onClose}
      title={sensor ? `${en.sensor} ${sensor.number}` : en.sensorDetails}
    >
      {sensor && (
        <View style={{ gap: 18 }}>
          {sensor.id.startsWith('NODE-') && (
            <Label style={{ color: colors.muted }}>{sensor.id} · full-sensor node</Label>
          )}
          <View style={styles.row}>
            <Chip tone={sensor.online ? 'green' : 'muted'} dot>
              {context.connection !== 'local'
                ? en.savedStatus
                : sensor.online
                  ? en.online
                  : en.offline}
            </Chip>
            <Label style={{ color: colors.muted }}>
              {en.section} {sensor.section} · {sensor.control ? en.controlsFans : en.sensingOnly}
            </Label>
          </View>
          {!sensor.online && (
            <Card style={{ backgroundColor: colors.amberSoft }}>
              <Label weight="bold">{en.missingReading}</Label>
              <Label style={{ marginTop: 5 }}>{en.sensorWhy}</Label>
            </Card>
          )}
          <Label style={{ color: colors.muted, fontSize: 12 }}>
            {sensor.online ? en.lastReading : en.lastKnown} ·{' '}
            {relativeTime(
              sensor.online ? snapshot.sampledAt : snapshot.sampledAt - 12 * 60_000,
              now,
            )}
          </Label>
          <View>
            {enabledMetrics(data.site).map((metric) => (
              <View
                key={metric}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Label>{en.metrics[metric]}</Label>
                <Label weight="bold" style={{ color: sensor.online ? colors.ink : colors.muted }}>
                  {sensor.readings[metric].toFixed(
                    metric === 'temperature' || metric === 'ammonia' ? 1 : 0,
                  )}{' '}
                  {metricUnits[metric]}
                </Label>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ flex: 1 }}>
              <Label style={{ color: colors.muted }}>{en.power}</Label>
              <Label weight="bold">
                {sensor.battery === null
                  ? en.pluggedIn
                  : `${sensor.battery}% ${en.battery.toLowerCase()}`}
              </Label>
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ color: colors.muted }}>{en.signal}</Label>
              <Label weight="bold">{en[sensor.signal]}</Label>
            </View>
          </View>
          {(canManageSensors(context) || (context.role === 'technician' && !!data.site.survey)) &&
            snapshot.sensors.some((n) => n.id === sensor.id) && (
              <SensorEditor key={sensor.id} sensor={sensor} onClose={onClose} />
            )}
        </View>
      )}
    </Sheet>
  );
}

export function ControlSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { context, requestFullPower } = useFarm();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose} title={en.confirmation}>
      <View style={{ gap: 20 }}>
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.greenSoft,
            padding: 16,
            borderRadius: 18,
          }}
        >
          <Fan size={30} color={colors.green} />
        </View>
        <Label>{context.connection === 'cloud' ? en.confirmCloud : en.confirmBody}</Label>
        <Chip tone="amber">{en.previewOnly}</Chip>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button
            testID="confirm-full-power"
            disabled={busy || context.connection === 'offline' || context.controlMode === 'monitor'}
            onPress={async () => {
              setBusy(true);
              await requestFullPower();
              setBusy(false);
              onClose();
            }}
            icon={ArrowRight}
          >
            {en.confirmButton}
          </Button>
          <Button variant="secondary" onPress={onClose}>
            {en.cancel}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

export function RequestStatus() {
  const { snapshot, now } = useFarm();
  const request = snapshot.request;
  if (!request || (request.status === 'applied' && snapshot.fanStage !== 'full')) return null;
  const copy = {
    pending: [en.requestPending, en.pendingHelp],
    applied: [en.requestApplied, en.appliedHelp],
    expired: [en.requestExpired, en.expiredHelp],
    rejected: [en.requestRejected, en.rejectedHelp],
  }[request.status];
  return (
    <View
      testID="request-status"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: request.status === 'applied' ? colors.greenSoft : colors.amberSoft,
        padding: 16,
        borderRadius: 12,
        gap: 5,
      }}
    >
      <Label weight="bold">{copy[0]}</Label>
      <Label style={{ fontSize: 12, lineHeight: 19 }}>{copy[1]}</Label>
      {request.status === 'pending' && (
        <Label weight="medium" style={{ fontSize: 12 }}>
          {en.expiry} {countdown(request.expiresAt, now)}
        </Label>
      )}
      {request.status === 'applied' && request.overrideExpiresAt && (
        <Label weight="medium" style={{ fontSize: 12 }}>
          {en.overrideEnds} {countdown(request.overrideExpiresAt, now)}
        </Label>
      )}
    </View>
  );
}

export function AddSensorWizard({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { context, perform, snapshot, data } = useFarm();
  const [step, setStep] = useState(0),
    [scanned, setScanned] = useState(false),
    [section, setSection] = useState<Section>('A');
  const house = data.site.survey?.house ?? data.house;
  const layout = houseGrid(house?.lengthMetres ?? 90, house?.widthMetres ?? 12);
  const selectedSection = layout.sections.includes(section) ? section : layout.sections[0]!;
  const [busy, setBusy] = useState(false);
  const [number] = useState(() =>
    String(
      Math.max(
        0,
        ...snapshot.sensors.map((n) => Number(n.number)),
        ...data.retired.map((n) => Number(n.number)),
      ) + 1,
    ).padStart(2, '0'),
  );
  const [role, setRole] = useState('sensing'),
    [test, setTest] = useState<'unanswered' | 'passed' | 'failed'>('unanswered'),
    [calibrated, setCalibrated] = useState(false);
  const pass =
    step === 0
      ? scanned
      : step === 3
        ? role === 'sensing' || test === 'passed'
        : step === 4
          ? calibrated
          : true;
  const title = [
    en.identifyTitle,
    en.placeTitle,
    en.assignTitle,
    en.testTitle,
    en.calibrationTitle,
    en.verifyTitle,
    en.finishTitle,
  ][step];
  const body = [
    en.identifyBody,
    en.placeBody,
    en.assignBody,
    en.testBody,
    en.calibrationHelp,
    en.verifyBody,
    en.finishBody,
  ][step];
  return (
    <Sheet visible={visible} onClose={onClose} title={en.wizardTitle}>
      <View style={{ gap: 20 }}>
        <Label style={{ color: colors.muted, fontSize: 12 }}>{en.wizardNote}</Label>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {en.wizardSteps.map((label, index) => (
            <View key={label} style={{ flex: 1, gap: 5 }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 3,
                  backgroundColor: index <= step ? colors.green : colors.border,
                }}
              />
              <Label style={{ fontSize: 9, color: colors.muted }}>{label}</Label>
            </View>
          ))}
        </View>
        <Label weight="bold" style={{ fontSize: 22, lineHeight: 29 }}>
          {title}
        </Label>
        <Label>{body}</Label>
        {step === 0 && (
          <Button
            icon={scanned ? Check : ScanLine}
            variant={scanned ? 'secondary' : 'primary'}
            onPress={() => setScanned(true)}
          >
            {scanned ? `Sample Sensor ${number} found` : en.sampleScan}
          </Button>
        )}
        {step === 1 && (
          <Choice
            values={layout.sections}
            selected={selectedSection}
            labels={
              Object.fromEntries(
                layout.sections.map((value) => [value, `${en.section} ${value}`]),
              ) as Record<Section, string>
            }
            onSelect={setSection}
          />
        )}
        {step === 2 && (
          <Choice
            values={context.controlMode === 'monitor' ? ['sensing'] : ['sensing', 'control']}
            selected={role}
            labels={{ sensing: en.sensingOnly, control: en.controlsFans }}
            onSelect={setRole}
          />
        )}
        {step === 3 &&
          (role === 'sensing' ? (
            <Chip>{en.sensingOnly}</Chip>
          ) : (
            <View style={{ gap: 10 }}>
              <Button icon={Check} variant="secondary" onPress={() => setTest('passed')}>
                {en.testYes}
              </Button>
              <Button variant="danger" onPress={() => setTest('failed')}>
                {en.testNo}
              </Button>
              {test === 'failed' && <Label style={{ color: colors.red }}>{en.testFailed}</Label>}
              {test === 'passed' && <Chip>{en.wizardSteps[3]} ✓</Chip>}
            </View>
          ))}
        {step === 4 && (
          <Button
            icon={Check}
            variant={calibrated ? 'secondary' : 'primary'}
            onPress={() => setCalibrated(true)}
          >
            {en.calibrationDemo}
          </Button>
        )}
        {step === 5 && (
          <Card style={{ backgroundColor: colors.greenSoft }}>
            {[
              `Sample Sensor ${number}`,
              `${en.section} ${selectedSection}`,
              role === 'control' ? en.testYes : en.sensingOnly,
              en.calibrationDemo,
            ].map((item) => (
              <View key={item} style={[styles.row, { paddingVertical: 7 }]}>
                <Check size={17} color={colors.green} />
                <Label>{item}</Label>
              </View>
            ))}
          </Card>
        )}
        {step === 6 ? (
          <Button onPress={onClose}>{en.done}</Button>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              disabled={
                busy || !pass || context.role !== 'technician' || context.connection !== 'local'
              }
              icon={ArrowRight}
              onPress={async () => {
                if (step !== 5) {
                  setStep((value) => value + 1);
                  return;
                }
                setBusy(true);
                if (
                  await perform(
                    {
                      type: 'addSensor',
                      section: selectedSection,
                      control: role === 'control',
                      tested: test === 'passed',
                      calibrated,
                    },
                    'Sensor added and saved.',
                  )
                )
                  setStep(6);
                setBusy(false);
              }}
            >
              {step === 5 ? en.finishPreview : en.continue}
            </Button>
            {step > 0 && (
              <Button variant="ghost" onPress={() => setStep((value) => value - 1)}>
                {en.back}
              </Button>
            )}
          </View>
        )}
      </View>
    </Sheet>
  );
}
