import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, View } from 'react-native';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react-native';
import {
  buildInstallationPlan,
  emptyEquipment,
  emptySiteSurvey,
  equipmentKinds,
  houseCapabilities,
  surveyMissing,
  type Answer,
  type SiteSurvey,
} from '../domain/siteWorkflow';
import { colors } from '../theme';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Choice, Label, styles } from './ui';

const steps = [
  'House & layout',
  'Equipment & control',
  'Hub, power & network',
  'Nodes & sensors',
  'Safety & review',
] as const;
const answerLabels: Record<Answer, string> = { yes: 'Yes', no: 'No', unknown: 'Unknown' };

function SelectQuestion<T extends string>({
  label,
  values,
  selected,
  labels,
  onSelect,
}: {
  label: string;
  values: readonly T[];
  selected: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Label weight="bold">{label}</Label>
      <Choice values={values} selected={selected} labels={labels} onSelect={onSelect} />
    </View>
  );
}

function Question({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Answer;
  onChange: (value: Answer) => void;
}) {
  return (
    <SelectQuestion
      label={label}
      values={['yes', 'no', 'unknown']}
      selected={value}
      labels={answerLabels}
      onSelect={onChange}
    />
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.row, { minHeight: 48 }]}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: value ? colors.green : colors.border,
          backgroundColor: value ? colors.green : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value && <Check size={15} color="#fff" />}
      </View>
      <Label style={{ flex: 1 }}>{label}</Label>
    </Pressable>
  );
}

const dimensionValues = ['0', '8', '12', '16', '20', '30', '60', '90', '120'] as const;
const dimensionLabels: Record<(typeof dimensionValues)[number], string> = {
  '0': 'Not measured',
  '8': '8 m',
  '12': '12 m',
  '16': '16 m',
  '20': '20 m',
  '30': '30 m',
  '60': '60 m',
  '90': '90 m',
  '120': '120 m',
};
const countValues = ['1', '2', '3', '4', '6', '8', '10', '12'] as const;
const countLabels = Object.fromEntries(countValues.map((value) => [value, value])) as Record<
  (typeof countValues)[number],
  string
>;

export function HouseSetupForm({ onDone }: { onDone: () => void; startOnSave?: boolean }) {
  const auth = useAuth();
  const { survey, data, perform, surveyDraftKey } = useFarm();
  const activeFarm = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;
  const [draft, setDraft] = useState<SiteSurvey>(() => {
    const value = data.site.survey ?? emptySiteSurvey(survey);
    value.farm.farmName ||= activeFarm.name;
    value.farm.houseName ||= 'Main house';
    value.farm.ownerName ||= 'Owner account';
    value.farm.technicianName ||= auth.record!.session.account.name;
    value.connectivity.region ||= 'Philippines';
    value.connectivity.phoneUseLocations ||= 'inside_house';
    value.sensors.plannedNodes ||= 1;
    value.sensors.placementNotes ||= 'three_zones';
    value.sensors.temperature = true;
    value.sensors.humidity = true;
    value.sensors.ammonia = true;
    value.sensors.co2 = true;
    value.sensors.litterMoisture = true;
    value.operations.dayResponder ||= 'owner';
    value.operations.nightResponder ||= 'same';
    value.operations.responseMinutes ||= 15;
    value.operations.powerFailureProcedure ||= 'no_plan';
    return value;
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(surveyDraftKey)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { draft?: SiteSurvey };
          if (parsed.draft?.schemaVersion === 1 && Array.isArray(parsed.draft.equipment))
            setDraft({
              ...parsed.draft,
              sensors: {
                ...parsed.draft.sensors,
                temperature: true,
                humidity: true,
                ammonia: true,
                co2: true,
                litterMoisture: true,
              },
            });
        } catch {
          /* Keep the server copy when a device-only draft is unreadable. */
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [surveyDraftKey]);

  const saveDraft = async () => {
    await AsyncStorage.setItem(surveyDraftKey, JSON.stringify({ savedAt: Date.now(), draft }));
    setSaved(true);
  };
  const next = async () => {
    await saveDraft();
    setStep((value) => Math.min(steps.length - 1, value + 1));
  };
  const setEquipment = (index: number, patch: Partial<SiteSurvey['equipment'][number]>) =>
    setDraft((current) => ({
      ...current,
      equipment: current.equipment.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  const finish = async () => {
    const problems = surveyMissing(draft);
    setMissing(problems);
    if (problems.length) return;
    setBusy(true);
    const ok = await perform(
      { type: 'saveSiteSurvey', value: { ...draft, completedAt: Date.now() } },
      'Survey saved. Installation plan generated.',
    );
    if (ok) {
      await AsyncStorage.removeItem(surveyDraftKey);
      onDone();
    }
    setBusy(false);
  };

  const planPreview = buildInstallationPlan(draft);
  const capabilityPreview = houseCapabilities(draft, planPreview);
  const hasEquipment = draft.equipment.some((item) => item.count > 0);
  const controlRequested = draft.equipment.some((item) => item.count > 0 && item.intendedControl);

  return (
    <View style={{ gap: 18 }}>
      {step === 0 && (
        <Card style={{ gap: 7, padding: 16 }}>
          <Label weight="bold">Installation survey</Label>
          <Label style={{ color: colors.muted }}>
            Farm ID {activeFarm.code} selects this target. Every answer below changes hardware,
            placement, measurements, connectivity, alerts, or control eligibility.
          </Label>
        </Card>
      )}
      <View style={{ gap: 7 }}>
        <Label style={{ color: colors.muted }}>
          Step {step + 1} of {steps.length}
        </Label>
        <Label weight="bold" style={{ fontSize: 20 }}>
          {steps[step]}
        </Label>
        <View style={{ height: 6, borderRadius: 4, backgroundColor: colors.border }}>
          <View
            style={{
              height: 6,
              width: `${((step + 1) / steps.length) * 100}%`,
              borderRadius: 4,
              backgroundColor: colors.green,
            }}
          />
        </View>
      </View>

      {step === 0 && (
        <>
          <Card style={{ gap: 5 }}>
            <Label weight="bold">{activeFarm.name}</Label>
            <Label>{activeFarm.code} · Main house</Label>
            <Label style={{ color: colors.muted }}>
              The account and Farm ID supply site identity.
            </Label>
          </Card>
          <SelectQuestion
            label="House type"
            values={['open', 'tunnel', 'mixed', 'unknown']}
            selected={draft.house.type}
            labels={{
              open: 'Open-sided',
              tunnel: 'Closed / tunnel',
              mixed: 'Mixed',
              unknown: 'Verify on site',
            }}
            onSelect={(type) => setDraft((s) => ({ ...s, house: { ...s.house, type } }))}
          />
          <SelectQuestion
            label="Measured house length"
            values={dimensionValues}
            selected={String(draft.house.lengthMetres) as (typeof dimensionValues)[number]}
            labels={dimensionLabels}
            onSelect={(value) =>
              setDraft((s) => ({ ...s, house: { ...s.house, lengthMetres: Number(value) } }))
            }
          />
          <SelectQuestion
            label="Measured house width"
            values={dimensionValues}
            selected={String(draft.house.widthMetres) as (typeof dimensionValues)[number]}
            labels={dimensionLabels}
            onSelect={(value) =>
              setDraft((s) => ({ ...s, house: { ...s.house, widthMetres: Number(value) } }))
            }
          />
          <SelectQuestion
            label="Flock type for environmental targets"
            values={['broiler', 'layer', 'breeder', 'other', 'unknown']}
            selected={draft.flock.type}
            labels={{
              broiler: 'Broiler',
              layer: 'Layer',
              breeder: 'Breeder',
              other: 'Other',
              unknown: 'Not selected',
            }}
            onSelect={(type) => setDraft((s) => ({ ...s, flock: { ...s.flock, type } }))}
          />
          <Question
            label="Temperature and ventilation targets by flock age are available"
            value={draft.flock.ageTargetsAvailable}
            onChange={(ageTargetsAvailable) =>
              setDraft((s) => ({ ...s, flock: { ...s.flock, ageTargetsAvailable } }))
            }
          />
          <SelectQuestion
            label="Main airflow layout"
            values={['side_openings', 'end_to_end', 'mixed_openings', 'verify']}
            selected={draft.house.structureNotes || 'verify'}
            labels={{
              side_openings: 'Side openings / curtains',
              end_to_end: 'End-to-end tunnel flow',
              mixed_openings: 'Mixed openings',
              verify: 'Needs placement review',
            }}
            onSelect={(structureNotes) =>
              setDraft((s) => ({ ...s, house: { ...s.house, structureNotes } }))
            }
          />
          <Question
            label="Known hot, cold, or poorly ventilated area"
            value={(draft.house.hotColdSpots || 'unknown') as Answer}
            onChange={(hotColdSpots) =>
              setDraft((s) => ({ ...s, house: { ...s.house, hotColdSpots } }))
            }
          />
          <Question
            label="Leaks, wet areas, or condensation can reach hardware"
            value={(draft.house.wetAreas || 'unknown') as Answer}
            onChange={(wetAreas) => setDraft((s) => ({ ...s, house: { ...s.house, wetAreas } }))}
          />
          <SelectQuestion
            label="Mounting and maintenance access"
            values={['clear', 'limited', 'washdown', 'verify']}
            selected={draft.house.mountingNotes || 'verify'}
            labels={{
              clear: 'Dry and easy to access',
              limited: 'Limited access',
              washdown: 'Washdown / heavy dust area',
              verify: 'Needs placement review',
            }}
            onSelect={(mountingNotes) =>
              setDraft((s) => ({ ...s, house: { ...s.house, mountingNotes } }))
            }
          />
        </>
      )}

      {step === 1 && (
        <>
          <Card style={{ gap: 6, padding: 16 }}>
            <Label weight="bold">Equipment decides control availability</Label>
            <Label style={{ color: colors.muted }}>
              A control request remains locked until electrical review, installation, commissioning,
              and the monitoring trial pass.
            </Label>
          </Card>
          <SelectQuestion
            label="Existing automatic controller"
            values={['present', 'absent', 'unknown']}
            selected={draft.controller.status}
            labels={{ present: 'Present', absent: 'Absent', unknown: 'Verify on site' }}
            onSelect={(status) =>
              setDraft((s) => ({ ...s, controller: { ...s.controller, status } }))
            }
          />
          {draft.controller.status !== 'absent' && (
            <>
              <Question
                label="Existing controller currently works"
                value={draft.controller.working}
                onChange={(working) =>
                  setDraft((s) => ({ ...s, controller: { ...s.controller, working } }))
                }
              />
              <Question
                label="Existing controller must remain in service"
                value={draft.controller.ownerWantsRetained}
                onChange={(ownerWantsRetained) =>
                  setDraft((s) => ({ ...s, controller: { ...s.controller, ownerWantsRetained } }))
                }
              />
            </>
          )}
          <Label weight="bold" style={{ fontSize: 17 }}>
            Equipment groups in this house
          </Label>
          {!draft.equipment.length && (
            <Card style={{ gap: 5 }}>
              <Label>No supported equipment recorded.</Label>
              <Label style={{ color: colors.muted }}>
                Monitoring functions can still be installed without equipment control.
              </Label>
            </Card>
          )}
          {draft.equipment.map((item, index) => (
            <Card key={item.id} style={{ gap: 12, padding: 16 }}>
              <SelectQuestion
                label="Equipment type"
                values={equipmentKinds.map((entry) => entry.key)}
                selected={item.kind}
                labels={
                  Object.fromEntries(
                    equipmentKinds.map((entry) => [entry.key, entry.label]),
                  ) as Record<typeof item.kind, string>
                }
                onSelect={(kind) => setEquipment(index, { kind })}
              />
              <SelectQuestion
                label="Quantity in this group"
                values={countValues}
                selected={String(item.count || 1) as (typeof countValues)[number]}
                labels={countLabels}
                onSelect={(value) => setEquipment(index, { count: Number(value) })}
              />
              <SelectQuestion
                label="Equipment location"
                values={['inlet_end', 'center', 'fan_end', 'side_wall', 'service_area']}
                selected={item.location || 'fan_end'}
                labels={{
                  inlet_end: 'Inlet end',
                  center: 'Center section',
                  fan_end: 'Fan / exhaust end',
                  side_wall: 'Side wall',
                  service_area: 'Service area',
                }}
                onSelect={(location) => setEquipment(index, { location })}
              />
              <Question
                label="Nameplate and model were photographed"
                value={item.model ? 'yes' : 'unknown'}
                onChange={(value) =>
                  setEquipment(index, { model: value === 'yes' ? 'nameplate_recorded' : '' })
                }
              />
              <SelectQuestion
                label="Verified electrical supply"
                values={['230v_single', '400v_three', 'other_verified', 'unknown']}
                selected={item.electricalRating || 'unknown'}
                labels={{
                  '230v_single': '230 V single phase',
                  '400v_three': '400 V three phase',
                  other_verified: 'Other · verified',
                  unknown: 'Not verified',
                }}
                onSelect={(electricalRating) => setEquipment(index, { electricalRating })}
              />
              <SelectQuestion
                label="Current control method"
                values={['manual', 'automatic', 'both', 'unknown']}
                selected={item.controlMethod}
                labels={{
                  manual: 'Manual',
                  automatic: 'Automatic',
                  both: 'Both',
                  unknown: 'Unknown',
                }}
                onSelect={(controlMethod) => setEquipment(index, { controlMethod })}
              />
              <SelectQuestion
                label="Observed condition"
                values={['working', 'damaged', 'intermittent', 'unknown']}
                selected={item.condition}
                labels={{
                  working: 'Working',
                  damaged: 'Damaged',
                  intermittent: 'Intermittent',
                  unknown: 'Not tested',
                }}
                onSelect={(condition) => setEquipment(index, { condition })}
              />
              <SelectQuestion
                label="Control interface"
                values={['on_off', 'staged', 'variable_speed', 'unknown']}
                selected={item.stages || 'unknown'}
                labels={{
                  on_off: 'On / off',
                  staged: 'Multiple stages',
                  variable_speed: 'Variable speed',
                  unknown: 'Needs electrical review',
                }}
                onSelect={(stages) => setEquipment(index, { stages })}
              />
              <Question
                label="Panel and circuit were identified"
                value={item.circuit ? 'yes' : 'unknown'}
                onChange={(value) =>
                  setEquipment(index, { circuit: value === 'yes' ? 'circuit_identified' : '' })
                }
              />
              <Question
                label="Powered by backup supply"
                value={item.backupPower}
                onChange={(backupPower) => setEquipment(index, { backupPower })}
              />
              <CheckRow
                label="Request CoopGuard automatic control for this group"
                value={item.intendedControl}
                onChange={(intendedControl) => setEquipment(index, { intendedControl })}
              />
              {item.intendedControl && (
                <SelectQuestion
                  label="Safe state if control or communication fails"
                  values={[
                    'manual_control',
                    'remain_on',
                    'remain_off',
                    'existing_controller',
                    'unknown',
                  ]}
                  selected={item.failureBehaviour || 'unknown'}
                  labels={{
                    manual_control: 'Return to manual control',
                    remain_on: 'Remain on',
                    remain_off: 'Remain off',
                    existing_controller: 'Return to existing controller',
                    unknown: 'Needs safety review',
                  }}
                  onSelect={(failureBehaviour) => setEquipment(index, { failureBehaviour })}
                />
              )}
              <Button
                variant="danger"
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    equipment: current.equipment.filter((entry) => entry.id !== item.id),
                  }))
                }
              >
                Remove equipment
              </Button>
            </Card>
          ))}
          <Button
            variant="secondary"
            onPress={() => {
              const equipment = emptyEquipment('fan');
              equipment.count = 1;
              setDraft((current) => ({ ...current, equipment: [...current.equipment, equipment] }));
            }}
          >
            Add equipment group
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <SelectQuestion
            label="Mains power reliability"
            values={['reliable', 'unstable', 'unknown']}
            selected={draft.power.reliability}
            labels={{ reliable: 'Reliable', unstable: 'Frequent outages', unknown: 'Unknown' }}
            onSelect={(reliability) =>
              setDraft((s) => ({ ...s, power: { ...s.power, reliability } }))
            }
          />
          <Question
            label="Generator, battery, or other backup is present"
            value={draft.power.backup}
            onChange={(backup) => setDraft((s) => ({ ...s, power: { ...s.power, backup } }))}
          />
          {draft.power.backup === 'yes' && (
            <SelectQuestion
              label="Backup transfer method"
              values={['automatic', 'manual', 'battery_only', 'unknown']}
              selected={draft.power.backupDetails || 'unknown'}
              labels={{
                automatic: 'Automatic transfer',
                manual: 'Manual generator start',
                battery_only: 'Battery / UPS only',
                unknown: 'Needs verification',
              }}
              onSelect={(backupDetails) =>
                setDraft((s) => ({ ...s, power: { ...s.power, backupDetails } }))
              }
            />
          )}
          <SelectQuestion
            label="Hub power source"
            values={['service_room', 'control_panel', 'house_outlet', 'new_circuit', 'unknown']}
            selected={draft.power.hubPowerLocation || 'unknown'}
            labels={{
              service_room: 'Protected service room',
              control_panel: 'Control panel supply',
              house_outlet: 'Protected house outlet',
              new_circuit: 'New dedicated circuit',
              unknown: 'No safe source confirmed',
            }}
            onSelect={(hubPowerLocation) =>
              setDraft((s) => ({ ...s, power: { ...s.power, hubPowerLocation } }))
            }
          />
          <Question
            label="Internet service is available at the farm"
            value={draft.connectivity.internet}
            onChange={(internet) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, internet } }))
            }
          />
          <Question
            label="Farm WiFi is available"
            value={draft.connectivity.farmWifi}
            onChange={(farmWifi) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, farmWifi } }))
            }
          />
          <SelectQuestion
            label="Safe hub location"
            values={['service_room', 'control_room', 'protected_house_wall', 'none']}
            selected={draft.connectivity.hubLocation || 'none'}
            labels={{
              service_room: 'Service room',
              control_room: 'Control room',
              protected_house_wall: 'Protected house wall',
              none: 'No safe location yet',
            }}
            onSelect={(hubLocation) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, hubLocation } }))
            }
          />
          <SelectQuestion
            label="LoRa antenna position"
            values={['high_clear', 'external_mast', 'inside_room', 'verify']}
            selected={draft.connectivity.antennaLocation || 'verify'}
            labels={{
              high_clear: 'High and clear inside house',
              external_mast: 'Protected external mast',
              inside_room: 'Inside service room',
              verify: 'Coverage test required',
            }}
            onSelect={(antennaLocation) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, antennaLocation } }))
            }
          />
          <SelectQuestion
            label="Radio obstruction level"
            values={['low', 'metal_partitions', 'multiple_buildings', 'unknown']}
            selected={draft.connectivity.radioObstructions || 'unknown'}
            labels={{
              low: 'Low',
              metal_partitions: 'Metal walls / partitions',
              multiple_buildings: 'Multiple buildings',
              unknown: 'Coverage test required',
            }}
            onSelect={(radioObstructions) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, radioObstructions } }))
            }
          />
          <SelectQuestion
            label="Where staff need local app access"
            values={['inside_house', 'service_area', 'whole_farm']}
            selected={draft.connectivity.phoneUseLocations || 'inside_house'}
            labels={{
              inside_house: 'Inside this house',
              service_area: 'House and service area',
              whole_farm: 'Across the farm',
            }}
            onSelect={(phoneUseLocations) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, phoneUseLocations } }))
            }
          />
          <SelectQuestion
            label="LoRa radio region"
            values={['Philippines']}
            selected="Philippines"
            labels={{ Philippines: 'Philippines' }}
            onSelect={(region) =>
              setDraft((s) => ({ ...s, connectivity: { ...s.connectivity, region } }))
            }
          />
        </>
      )}

      {step === 3 && (
        <>
          <SelectQuestion
            label="Planned node count"
            values={countValues}
            selected={String(draft.sensors.plannedNodes || 1) as (typeof countValues)[number]}
            labels={countLabels}
            onSelect={(value) =>
              setDraft((s) => ({ ...s, sensors: { ...s.sensors, plannedNodes: Number(value) } }))
            }
          />
          <Card style={{ gap: 7, padding: 16 }}>
            <Label weight="bold">Complete sensor set on every node</Label>
            <Label style={{ color: colors.muted }}>
              Temperature, humidity, ammonia, carbon dioxide, and litter-moisture sensing are
              assigned automatically. The technician only decides the node count and placement.
            </Label>
          </Card>
          <CheckRow
            label="Enable microphone / unusual sound collection"
            value={draft.sensors.microphone}
            onChange={(microphone) =>
              setDraft((s) => ({ ...s, sensors: { ...s.sensors, microphone } }))
            }
          />
          <SelectQuestion
            label="Node placement pattern"
            values={['three_zones', 'two_zones', 'single_center', 'custom_after_test']}
            selected={draft.sensors.placementNotes || 'three_zones'}
            labels={{
              three_zones: 'Inlet, center, and exhaust zones',
              two_zones: 'Two opposite house zones',
              single_center: 'Single center zone',
              custom_after_test: 'Set after LoRa coverage test',
            }}
            onSelect={(placementNotes) =>
              setDraft((s) => ({ ...s, sensors: { ...s.sensors, placementNotes } }))
            }
          />
          {draft.sensors.microphone && (
            <Card style={{ gap: 12, padding: 16 }}>
              <Label weight="bold">Sound anomaly collection</Label>
              <Label style={{ color: colors.muted }}>
                Edge AI flags unusual flock sounds for inspection. It cannot drive equipment.
              </Label>
              <Question
                label="Owner permits poultry sound collection"
                value={draft.ai.audioConsent}
                onChange={(audioConsent) =>
                  setDraft((s) => ({ ...s, ai: { ...s.ai, audioConsent } }))
                }
              />
              <SelectQuestion
                label="Microphone position"
                values={['center', 'two_zones', 'away_from_fans', 'verify']}
                selected={draft.ai.microphoneLocations || 'verify'}
                labels={{
                  center: 'Center of house',
                  two_zones: 'Two house zones',
                  away_from_fans: 'Away from fans and feeders',
                  verify: 'Choose after noise test',
                }}
                onSelect={(microphoneLocations) =>
                  setDraft((s) => ({ ...s, ai: { ...s.ai, microphoneLocations } }))
                }
              />
              <SelectQuestion
                label="Main background noise"
                values={['fans', 'feeders', 'road', 'mixed', 'low']}
                selected={draft.ai.noiseSources || 'mixed'}
                labels={{
                  fans: 'Fans',
                  feeders: 'Feeders',
                  road: 'Road',
                  mixed: 'Mixed',
                  low: 'Low',
                }}
                onSelect={(noiseSources) =>
                  setDraft((s) => ({ ...s, ai: { ...s.ai, noiseSources } }))
                }
              />
              <SelectQuestion
                label="Who records matching flock observations"
                values={['owner', 'assigned_worker', 'technician']}
                selected={draft.ai.observationRecorder || 'assigned_worker'}
                labels={{
                  owner: 'Owner',
                  assigned_worker: 'Assigned worker',
                  technician: 'Technician',
                }}
                onSelect={(observationRecorder) =>
                  setDraft((s) => ({ ...s, ai: { ...s.ai, observationRecorder } }))
                }
              />
            </Card>
          )}
        </>
      )}

      {step === 4 && (
        <>
          <SelectQuestion
            label="Primary alert responder"
            values={['owner', 'assigned_worker', 'owner_and_worker']}
            selected={draft.operations.dayResponder || 'owner'}
            labels={{
              owner: 'Owner',
              assigned_worker: 'Assigned worker',
              owner_and_worker: 'Owner and worker',
            }}
            onSelect={(dayResponder) =>
              setDraft((s) => ({ ...s, operations: { ...s.operations, dayResponder } }))
            }
          />
          <SelectQuestion
            label="After-hours responder"
            values={['same', 'owner', 'assigned_worker']}
            selected={draft.operations.nightResponder || 'same'}
            labels={{ same: 'Same responder', owner: 'Owner', assigned_worker: 'Assigned worker' }}
            onSelect={(nightResponder) =>
              setDraft((s) => ({ ...s, operations: { ...s.operations, nightResponder } }))
            }
          />
          <SelectQuestion
            label="Expected response time"
            values={['5', '10', '15', '30', '60']}
            selected={String(draft.operations.responseMinutes || 15)}
            labels={{
              '5': '5 min',
              '10': '10 min',
              '15': '15 min',
              '30': '30 min',
              '60': '60 min',
            }}
            onSelect={(value) =>
              setDraft((s) => ({
                ...s,
                operations: { ...s.operations, responseMinutes: Number(value) },
              }))
            }
          />
          {hasEquipment && (
            <SelectQuestion
              label="Authorized manual equipment operators"
              values={['owner', 'trained_workers', 'owner_and_trained_workers']}
              selected={draft.operations.manualOperators || 'owner_and_trained_workers'}
              labels={{
                owner: 'Owner only',
                trained_workers: 'Trained workers',
                owner_and_trained_workers: 'Owner and trained workers',
              }}
              onSelect={(manualOperators) =>
                setDraft((s) => ({ ...s, operations: { ...s.operations, manualOperators } }))
              }
            />
          )}
          <SelectQuestion
            label="Immediate action when mains power is lost"
            values={['start_generator', 'inspect_and_manual_ventilation', 'call_owner', 'no_plan']}
            selected={draft.operations.powerFailureProcedure || 'no_plan'}
            labels={{
              start_generator: 'Start generator and inspect',
              inspect_and_manual_ventilation: 'Inspect and use manual ventilation',
              call_owner: 'Call owner / responder',
              no_plan: 'No verified response plan',
            }}
            onSelect={(powerFailureProcedure) =>
              setDraft((s) => ({ ...s, operations: { ...s.operations, powerFailureProcedure } }))
            }
          />
          <SelectQuestion
            label="Visible wiring condition"
            values={['appears_safe', 'damaged', 'unknown']}
            selected={draft.safety.wiring}
            labels={{
              appears_safe: 'No visible damage',
              damaged: 'Damaged / unsafe',
              unknown: 'Electrical review required',
            }}
            onSelect={(wiring) => setDraft((s) => ({ ...s, safety: { ...s.safety, wiring } }))}
          />
          <Question
            label="Water can reach the hub, nodes, panels, or actuator wiring"
            value={draft.safety.waterRisk}
            onChange={(waterRisk) =>
              setDraft((s) => ({ ...s, safety: { ...s.safety, waterRisk } }))
            }
          />
          <SelectQuestion
            label="Installation hazards"
            values={['none_seen', 'height_access', 'wet_area', 'damaged_wiring', 'multiple']}
            selected={draft.safety.hazards || 'none_seen'}
            labels={{
              none_seen: 'None observed',
              height_access: 'Height / access risk',
              wet_area: 'Wet area',
              damaged_wiring: 'Damaged wiring',
              multiple: 'Multiple hazards',
            }}
            onSelect={(hazards) => setDraft((s) => ({ ...s, safety: { ...s.safety, hazards } }))}
          />
          {controlRequested && (
            <SelectQuestion
              label="Electrical control assessment"
              values={['approved', 'required', 'not_required', 'unknown']}
              selected={draft.safety.electricalAssessment}
              labels={{
                approved: 'Approved and recorded',
                required: 'Still required',
                not_required: 'Monitor only',
                unknown: 'Not verified',
              }}
              onSelect={(electricalAssessment) =>
                setDraft((s) => ({ ...s, safety: { ...s.safety, electricalAssessment } }))
              }
            />
          )}
          <Question
            label="Owner permits installation photos"
            value={draft.farm.photoPermission}
            onChange={(photoPermission) =>
              setDraft((s) => ({ ...s, farm: { ...s.farm, photoPermission } }))
            }
          />
          {draft.farm.photoPermission === 'yes' && (
            <Card style={{ gap: 4, padding: 16 }}>
              <Label weight="bold">Installation evidence captured and labelled</Label>
              {(
                [
                  ['exterior', 'House exterior and dimensions'],
                  ['interior', 'Interior layout and airflow openings'],
                  ['controllerAndEquipment', 'Controller and installed equipment'],
                  ['panelsAndNameplates', 'Panels and equipment nameplates'],
                  ['powerAndGenerator', 'Hub power and backup supply'],
                  ['hubAndSensorLocations', 'Hub, antenna, and node locations'],
                  ['hazardsAndWetAreas', 'Wiring hazards and wet areas'],
                ] as const
              ).map(([key, label]) => (
                <CheckRow
                  key={key}
                  label={label}
                  value={draft.evidence[key]}
                  onChange={(value) =>
                    setDraft((s) => ({ ...s, evidence: { ...s.evidence, [key]: value } }))
                  }
                />
              ))}
            </Card>
          )}
          <SelectQuestion
            label="Requested operating mode"
            values={
              controlRequested ? ['monitor', 'control', 'undecided'] : ['monitor', 'undecided']
            }
            selected={
              controlRequested || draft.decision.desiredMode !== 'control'
                ? draft.decision.desiredMode
                : 'undecided'
            }
            labels={{
              monitor: 'Monitor only',
              control: 'Request control',
              undecided: 'Decide after review',
            }}
            onSelect={(desiredMode) =>
              setDraft((s) => ({ ...s, decision: { ...s.decision, desiredMode } }))
            }
          />
          <Card style={{ gap: 8, padding: 16 }}>
            <Label weight="bold">Functions for this house</Label>
            <Label weight="bold">App</Label>
            {capabilityPreview.app.map((item) => (
              <Label key={item}>• {item}</Label>
            ))}
            <Label weight="bold">Hub and nodes</Label>
            {capabilityPreview.hardware.map((item) => (
              <Label key={item}>• {item}</Label>
            ))}
            <Label style={{ color: colors.muted }}>{capabilityPreview.control}</Label>
          </Card>
          <CheckRow
            label="Owner reviewed the recorded installation findings"
            value={draft.decision.ownerAcknowledged}
            onChange={(ownerAcknowledged) =>
              setDraft((s) => ({ ...s, decision: { ...s.decision, ownerAcknowledged } }))
            }
          />
          <CheckRow
            label="Technician confirms the survey is accurate"
            value={draft.decision.technicianConfirmed}
            onChange={(technicianConfirmed) =>
              setDraft((s) => ({ ...s, decision: { ...s.decision, technicianConfirmed } }))
            }
          />
          {missing.length > 0 && (
            <Card style={{ gap: 6, borderColor: colors.red }}>
              <Label weight="bold" style={{ color: colors.red }}>
                Complete these required items
              </Label>
              {missing.map((item) => (
                <Label key={item}>• {item}</Label>
              ))}
            </Card>
          )}
          <Label style={{ color: colors.muted }}>
            Completing the survey generates a plan. It does not enable equipment control.
          </Label>
        </>
      )}

      {saved && <Label style={{ color: colors.green }}>Draft saved on this phone.</Label>}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {step > 0 && (
          <Button
            icon={ArrowLeft}
            variant="secondary"
            onPress={() => setStep((value) => value - 1)}
          >
            Back
          </Button>
        )}
        <Button icon={Save} variant="ghost" onPress={() => void saveDraft()}>
          Save draft
        </Button>
        {step < steps.length - 1 ? (
          <Button icon={ArrowRight} onPress={() => void next()}>
            Save & continue
          </Button>
        ) : (
          <Button icon={Check} disabled={busy} onPress={() => void finish()}>
            Complete survey
          </Button>
        )}
      </View>
    </View>
  );
}
