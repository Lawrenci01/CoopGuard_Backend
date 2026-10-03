import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, Fan } from 'lucide-react-native';
import { useFarm } from '../state/FarmProvider';
import { canRequestControl } from '../domain/policy';
import { equipmentKinds } from '../domain/siteWorkflow';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { Button, Card, Label, Sheet, styles } from './ui';
import { ControlSheet, RequestStatus } from './FarmSheets';

export function Equipment() {
  const { context, snapshot, data } = useFarm();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const commissioned =
    data.site.status === 'normal_monitor' || data.site.status === 'normal_control';
  const equipment = data.site.plan?.equipment ?? [];
  const equipmentSummary = equipment
    .map(
      (item) =>
        `${equipmentKinds.find((kind) => kind.key === item.kind)?.label ?? item.kind} (${item.count})`,
    )
    .join(' · ');
  const controllableFan = equipment.some(
    (item) => item.kind === 'fan' && item.controlRequested,
  );
  const stage = !data.site.survey
    ? 'Survey required'
    : !commissioned
      ? 'Commissioning required'
      : context.controlMode === 'monitor'
        ? en.controlMode.monitor
        : snapshot.fanStage === 'full'
          ? en.fanStageFull
          : en.fanStageHigh;
  const requestActive = snapshot.request?.status === 'pending' || snapshot.fanStage === 'full';

  return (
    <>
      <Pressable
        testID="open-equipment"
        accessibilityRole="button"
        accessibilityLabel={`Equipment, ${stage}`}
        onPress={() => setOpen(true)}
      >
        <Card style={{ padding: 16 }}>
          <View style={styles.row}>
            <Fan color={colors.green} size={23} />
            <View style={{ flex: 1, gap: 3 }}>
              <Label weight="bold">Equipment</Label>
              <Label style={{ fontSize: 12, color: colors.muted }}>
                {stage}
                {context.connection !== 'local' ? ' · last reported' : ' · sample'}
              </Label>
            </View>
            <ChevronRight color={colors.muted} size={20} />
          </View>
        </Card>
      </Pressable>
      {!open && <RequestStatus />}
      <Sheet visible={open} title="Equipment" onClose={() => setOpen(false)}>
        <View style={{ gap: 18 }}>
          <Label weight="bold">{equipmentSummary || 'No surveyed equipment'}</Label>
          <Label>{stage}</Label>
          <Label>
            {context.controlMode === 'monitor'
              ? en.monitorNote
              : 'These are sample output settings. No equipment is connected.'}
          </Label>
          {!commissioned ? (
            <Label>
              A technician must approve the plan, install the system, complete commissioning and
              finish the monitoring trial before controls can become available.
            </Label>
          ) : context.controlMode === 'full' && controllableFan ? (
            <>
              <Label>Sample ventilation output only. No physical equipment is connected.</Label>
              <Button
                testID="full-power"
                disabled={!canRequestControl(context) || requestActive}
                onPress={() => {
                  setOpen(false);
                  setConfirm(true);
                }}
              >
                {en.fullPower}
              </Button>
            </>
          ) : context.controlMode === 'full' ? (
            <Label>No surveyed fan group is available for this sample control action.</Label>
          ) : null}
          {context.connection === 'offline' && <Label>{en.offlineAction}</Label>}
          <RequestStatus />
        </View>
      </Sheet>
      <ControlSheet visible={confirm} onClose={() => setConfirm(false)} />
    </>
  );
}
