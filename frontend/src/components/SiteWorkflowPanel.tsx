import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  checklistComplete,
  commissioningChecks,
  equipmentKinds,
  houseCapabilities,
  installationChecks,
  siteStatusLabel,
  trialChecks,
  type ChecklistValue,
  type CommissioningCheck,
  type InstallationCheck,
  type TrialCheck,
} from '../domain/siteWorkflow';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { useAuth } from '../state/AuthProvider';
import { farmQr } from '../domain/deviceSimulation';
import { Button, Card, Chip, Choice, Label } from './ui';
import { DeviceSimulationPanel } from './DeviceSimulationPanel';

const checkLabels: Record<ChecklistValue, string> = {
  pending: 'Pending',
  passed: 'Passed',
  na: 'N/A',
};

function tone(status: string): 'green' | 'amber' | 'blue' | 'muted' {
  if (status.startsWith('normal_')) return 'green';
  if (status === 'monitoring_trial' || status === 'commissioning') return 'blue';
  if (status === 'not_started') return 'muted';
  return 'amber';
}

function Checklist({
  stage,
  values,
  definitions,
}: {
  stage: 'installation' | 'commissioning' | 'trial';
  values: Record<string, ChecklistValue>;
  definitions: readonly (readonly [string, string, boolean])[];
}) {
  const { perform, data } = useFarm();
  return (
    <View style={{ gap: 12 }}>
      {definitions.map(([key, label, allowNa]) => (
        <Card key={key} style={{ padding: 14, gap: 9 }}>
          <Label>{label}</Label>
          <Choice
            values={
              allowNa && data.site.plan?.recommendedMode !== 'full_candidate'
                ? ['pending', 'passed', 'na']
                : ['pending', 'passed']
            }
            selected={values[key]!}
            labels={checkLabels}
            onSelect={(value) =>
              void perform(
                {
                  type: 'siteChecklist',
                  stage,
                  key: key as InstallationCheck | CommissioningCheck | TrialCheck,
                  value,
                },
                'Checklist updated.',
              )
            }
            testPrefix={`${stage}-${key}`}
          />
        </Card>
      ))}
    </View>
  );
}

export function SiteWorkflowPanel({ onEdit }: { onEdit: () => void }) {
  const { data, perform } = useFarm();
  const auth = useAuth();
  const site = data.site;
  const plan = site.plan;
  const survey = site.survey;
  const capabilities = survey && plan ? houseCapabilities(survey, plan) : null;
  const farm = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 10, alignItems: 'center' }}>
        <Label weight="bold" style={{ fontSize: 18 }}>
          Farm target
        </Label>
        <QRCode value={farmQr(farm.code)} size={156} color={colors.ink} backgroundColor="#fff" />
        <Label weight="bold">{farm.code}</Label>
        <Label style={{ color: colors.muted, textAlign: 'center' }}>
          This QR selects a farm. The signed-in technician account authorizes access.
        </Label>
      </Card>
      <Card style={{ gap: 10 }}>
        <Chip tone={tone(site.status)}>{siteStatusLabel(site.status)}</Chip>
        <Label weight="bold" style={{ fontSize: 19 }}>
          {survey
            ? `${survey.farm.farmName} · ${survey.farm.houseName}`
            : 'Site survey not completed'}
        </Label>
        <Label style={{ color: colors.muted }}>
          Survey → plan → installation → commissioning → monitoring trial → activation
        </Label>
        <Button testID="edit-house" variant="secondary" onPress={onEdit}>
          {survey ? 'Review or update survey' : 'Start site survey'}
        </Button>
      </Card>

      {plan && (
        <Card style={{ gap: 10 }}>
          <Label weight="bold" style={{ fontSize: 17 }}>
            Generated installation plan
          </Label>
          <Label>
            {plan.nodeCount} nodes · {plan.sections} house sections
          </Label>
          <Label>
            {plan.metrics.length ? plan.metrics.join(' · ') : 'No measurements selected'}
          </Label>
          <Label>
            {plan.connectivity === 'cloud_sync'
              ? 'Local operation with cloud synchronization'
              : 'Local operation; cloud unavailable until internet is added'}
          </Label>
          <Label weight="bold">
            {plan.recommendedMode === 'full_candidate'
              ? 'Full-control candidate'
              : 'Monitor-only plan'}
          </Label>
          {capabilities && (
            <Card style={{ gap: 6, padding: 14 }}>
              <Label weight="bold">Available app functions</Label>
              {capabilities.app.map((item) => (
                <Label key={item}>• {item}</Label>
              ))}
              <Label weight="bold">Configured hub and node functions</Label>
              {capabilities.hardware.map((item) => (
                <Label key={item}>• {item}</Label>
              ))}
              <Label style={{ color: colors.muted }}>{capabilities.control}</Label>
            </Card>
          )}
          {plan.equipment.length > 0 && (
            <View style={{ gap: 4 }}>
              {plan.equipment.map((item) => (
                <Label key={item.id}>
                  {equipmentKinds.find((kind) => kind.key === item.kind)?.label}: {item.count}
                  {item.controlRequested ? ' · control requested' : ' · monitoring only'}
                </Label>
              ))}
            </View>
          )}
          {plan.blockers.length > 0 && (
            <View style={{ gap: 5 }}>
              <Label weight="bold" style={{ color: colors.red }}>
                Installation blockers
              </Label>
              {plan.blockers.map((item) => (
                <Label key={item}>• {item}</Label>
              ))}
            </View>
          )}
          {plan.controlRestrictions.length > 0 && (
            <View style={{ gap: 5 }}>
              <Label weight="bold">Control restrictions</Label>
              {plan.controlRestrictions.map((item) => (
                <Label key={item}>• {item}</Label>
              ))}
            </View>
          )}
          {site.status === 'review_required' && (
            <Button
              testID="approve-plan"
              disabled={plan.blockers.length > 0}
              onPress={() =>
                void perform({ type: 'approveSitePlan' }, 'Installation plan approved.')
              }
            >
              Approve installation plan
            </Button>
          )}
        </Card>
      )}

      {plan && <DeviceSimulationPanel />}

      {site.status === 'approved_install' && (
        <Card style={{ gap: 10 }}>
          <Label weight="bold">Hardware preparation</Label>
          <Label>
            Configure, label and bench-test the hub and nodes against this approved plan before
            installation.
          </Label>
          <Button
            testID="start-installation"
            onPress={() => void perform({ type: 'startInstallation' }, 'Installation started.')}
          >
            Start on-site installation
          </Button>
        </Card>
      )}

      {site.status === 'installing' && (
        <>
          <Label weight="bold" style={{ fontSize: 18 }}>
            Installation checklist
          </Label>
          <Checklist
            stage="installation"
            values={site.installation}
            definitions={installationChecks}
          />
          <Button
            testID="begin-commissioning"
            disabled={!checklistComplete(site.installation, installationChecks)}
            onPress={() => void perform({ type: 'beginCommissioning' }, 'Commissioning started.')}
          >
            Begin commissioning
          </Button>
        </>
      )}

      {site.status === 'commissioning' && (
        <>
          <Label weight="bold" style={{ fontSize: 18 }}>
            Commissioning checklist
          </Label>
          <Label style={{ color: colors.muted }}>
            “N/A” is available only where the approved plan contains no related control equipment.
          </Label>
          <Checklist
            stage="commissioning"
            values={site.commissioning}
            definitions={commissioningChecks}
          />
          <Button
            testID="start-trial"
            disabled={!checklistComplete(site.commissioning, commissioningChecks)}
            onPress={() =>
              void perform({ type: 'startMonitoringTrial' }, 'Monitoring trial started.')
            }
          >
            Start monitoring trial
          </Button>
        </>
      )}

      {site.status === 'monitoring_trial' && (
        <>
          <Card style={{ gap: 8 }}>
            <Label weight="bold">Monitoring trial</Label>
            <Label>
              Keep automatic control locked while readings, alerts and thresholds are compared with
              actual house conditions.
            </Label>
          </Card>
          <Checklist stage="trial" values={site.trial} definitions={trialChecks} />
          <View style={{ gap: 10 }}>
            <Button
              testID="activate-monitor"
              disabled={!checklistComplete(site.trial, trialChecks)}
              onPress={() =>
                void perform(
                  { type: 'activateSite', mode: 'monitor' },
                  'Monitor-only operation activated.',
                )
              }
            >
              Activate monitor-only
            </Button>
            {plan?.recommendedMode === 'full_candidate' && (
              <Button
                testID="activate-control"
                disabled={!checklistComplete(site.trial, trialChecks)}
                onPress={() =>
                  void perform(
                    { type: 'activateSite', mode: 'full' },
                    'Full-control mode activated.',
                  )
                }
              >
                Activate full control
              </Button>
            )}
          </View>
        </>
      )}

      {(site.status === 'normal_monitor' || site.status === 'normal_control') && (
        <Card style={{ gap: 8 }}>
          <Label weight="bold">House is in Normal mode</Label>
          <Label>
            {site.status === 'normal_control'
              ? 'Only equipment approved and tested during commissioning may receive control commands.'
              : 'CoopGuard monitors and recommends actions. It does not drive house equipment.'}
          </Label>
        </Card>
      )}
    </View>
  );
}

export function OwnerSiteSummary() {
  const { data } = useFarm();
  const site = data.site;
  const survey = site.survey;
  return (
    <Card style={{ gap: 9 }}>
      <Label weight="bold">House profile</Label>
      <Chip tone={tone(site.status)}>{siteStatusLabel(site.status)}</Chip>
      {survey ? (
        <>
          <Label>
            {survey.farm.farmName} · {survey.farm.houseName}
          </Label>
          <Label>
            {survey.house.lengthMetres} m × {survey.house.widthMetres} m · {survey.house.type}
          </Label>
          <Label style={{ color: colors.muted }}>
            The CoopGuard technician maintains the survey, installation plan and commissioning
            record.
          </Label>
        </>
      ) : (
        <Label>Waiting for a CoopGuard technician to conduct the site survey.</Label>
      )}
    </Card>
  );
}
