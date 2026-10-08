import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronRight,
  Eye,
  Gauge,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { HouseSetupForm } from './HouseSetupForm';
import { SiteWorkflowPanel } from './SiteWorkflowPanel';
import { AccountSheet } from './AccountSheet';
import { Maintenance } from './FarmManagement';
import { DeviceSimulationPanel } from './DeviceSimulationPanel';
import { Button, Card, Chip, Label, styles } from './ui';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { colors } from '../theme';
import { relativeTime } from '../i18n/en';
import { BrandMark } from './Brand';

const progressLabels = [
  'Survey',
  'Review',
  'Provision',
  'Install',
  'Commission',
  'Trial',
  'Activate',
];

function workflowStage(status: string) {
  if (status === 'not_started') return 0;
  if (status === 'review_required') return 1;
  if (status === 'approved_install') return 2;
  if (status === 'installing') return 3;
  if (status === 'commissioning') return 4;
  if (status === 'monitoring_trial') return 5;
  return 7;
}

function ProgressRail({ current }: { current: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 8,
        paddingTop: 12,
        paddingBottom: 10,
      }}
    >
      {progressLabels.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {index < progressLabels.length - 1 && (
              <View
                style={{
                  position: 'absolute',
                  top: 11,
                  left: '64%',
                  right: '-36%',
                  height: 1,
                  backgroundColor: done ? colors.green : colors.border,
                }}
              />
            )}
            <View
              style={{
                width: 23,
                height: 23,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? colors.green : active ? colors.greenSoft : '#ECEEEC',
                borderWidth: active ? 1.5 : 0,
                borderColor: colors.green,
              }}
            >
              {done ? (
                <Check size={12} color="#fff" strokeWidth={2.5} />
              ) : (
                <Label
                  weight="bold"
                  style={{ fontSize: 8, color: active ? colors.green : '#A1A7A3' }}
                >
                  {index + 1}
                </Label>
              )}
            </View>
            <Label
              numberOfLines={1}
              style={{ fontSize: 6, color: done || active ? colors.green : '#A1A7A3' }}
            >
              {label}
            </Label>
          </View>
        );
      })}
    </View>
  );
}

function ToolCard({
  icon: Icon,
  title,
  copy,
  onPress,
  testID,
  tone = 'green',
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  onPress: () => void;
  testID?: string;
  tone?: 'green' | 'blue';
}) {
  const color = tone === 'blue' ? colors.blue : colors.green;
  const background = tone === 'blue' ? colors.blueSoft : colors.greenSoft;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.row,
        { padding: 14, gap: 12, opacity: pressed ? 0.76 : 1 },
      ]}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Label weight="bold">{title}</Label>
        <Label style={{ color: colors.muted, fontSize: 10 }}>{copy}</Label>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export function TechnicianSetupWorkspace({
  canPreviewOwner,
  onPreviewOwner,
}: {
  canPreviewOwner: boolean;
  onPreviewOwner: () => void;
}) {
  const auth = useAuth();
  const farm = useFarm();
  const insets = useSafeAreaInsets();
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [account, setAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState(false);
  const [maintenance, setMaintenance] = useState<'calibration' | 'software' | 'diagnostics' | null>(
    null,
  );
  const target = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;
  const stage = workflowStage(farm.data.site.status);
  const activated = ['normal_monitor', 'normal_control'].includes(farm.data.site.status);
  const initials = auth
    .record!.session.account.name.split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const showBack = devices || !!maintenance;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          backgroundColor: colors.greenDark,
          paddingTop: insets.top + 15,
          paddingBottom: 15,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BrandMark size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Label style={{ color: '#FFFFFF9E', fontSize: 10 }}>TECHNICIAN SETUP</Label>
          <Label weight="bold" style={{ color: '#fff', fontSize: 20 }}>
            {target.name}
          </Label>
          <Label style={{ color: '#FFFFFFB8', fontSize: 10 }}>Farm ID {target.code}</Label>
        </View>
        <Pressable
          testID="technician-account"
          accessibilityRole="button"
          accessibilityLabel="Account"
          onPress={() => setAccount(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#FFFFFF33',
            backgroundColor: '#FFFFFF1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Label weight="bold" style={{ color: '#fff', fontSize: 11 }}>
            {initials}
          </Label>
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: colors.amberSoft,
          paddingHorizontal: 20,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 9,
        }}
      >
        <LockKeyhole size={16} color="#78510B" />
        <View style={{ flex: 1 }}>
          <Label weight="bold" style={{ color: '#78510B', fontSize: 10 }}>
            Installation workspace only
          </Label>
          <Label style={{ color: '#78510B', fontSize: 9 }}>
            Operational readings remain hidden unless this visit was opened by scanning its Farm QR.
          </Label>
        </View>
      </View>
      <ProgressRail current={stage} />

      <ScrollView
        testID="technician-setup-workspace"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.green]}
            tintColor={colors.green}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await farm.refresh();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        contentContainerStyle={{
          paddingTop: 17,
          paddingBottom: insets.bottom + 30,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 }}>
          <Label
            testID="connection-status"
            style={{ color: farm.connected ? colors.muted : colors.amber, fontSize: 10 }}
          >
            {farm.syncing
              ? 'Syncing setup records…'
              : farm.connected
                ? `${auth.activeConnection === 'hub' ? 'Farm hub' : 'Cloud'} · synced ${relativeTime(farm.lastSyncedAt, farm.now).toLowerCase()}`
                : 'Server unavailable · saved setup records'}
          </Label>

          {showBack && (
            <Button
              testID="technician-tools-back"
              compact
              variant="ghost"
              onPress={() => {
                setDevices(false);
                setMaintenance(null);
              }}
            >
              ← Technician tools
            </Button>
          )}

          {devices ? (
            <>
              <View style={{ gap: 5 }}>
                <Chip tone="green">{activated ? 'ACTIVATED' : 'INSTALLATION'}</Chip>
                <Label weight="bold" style={{ fontSize: 24, lineHeight: 30 }}>
                  Device management
                </Label>
                <Label style={{ color: colors.muted }}>
                  Add, scan, inspect or remove installed hardware for {target.name}.
                </Label>
              </View>
              <DeviceSimulationPanel />
            </>
          ) : maintenance ? (
            <Maintenance mode={maintenance} />
          ) : editingSurvey ? (
            <HouseSetupForm onDone={() => setEditingSurvey(false)} />
          ) : (
            <>
              {activated && (
                <Card
                  style={{
                    backgroundColor: colors.greenDark,
                    borderColor: colors.greenDark,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#FFFFFF1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheck size={29} color="#ACD0B6" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Label style={{ color: '#FFFFFF8C', fontSize: 9 }}>Installation complete</Label>
                    <Label weight="bold" style={{ color: '#fff', fontSize: 19 }}>
                      {farm.data.site.status === 'normal_control' ? 'Full control' : 'Monitor only'}
                    </Label>
                    <Label style={{ color: '#FFFFFFA6', fontSize: 9 }}>
                      Hub reporting ·{' '}
                      {
                        farm.data.deviceSimulation.nodes.filter(
                          (node) => node.status === 'reporting',
                        ).length
                      }{' '}
                      of {farm.data.deviceSimulation.nodes.length} nodes reporting
                    </Label>
                  </View>
                  <Chip tone="green">Connected</Chip>
                </Card>
              )}

              {!activated && <SiteWorkflowPanel onEdit={() => setEditingSurvey(true)} />}

              <Label weight="bold" style={{ fontSize: 18 }}>
                Technician tools
              </Label>
              <View style={{ gap: 9 }}>
                {farm.data.site.plan && (
                  <ToolCard
                    testID="settings-devices"
                    icon={RadioTower}
                    title="Device management"
                    copy="Add, scan, inspect or remove the farm hub and sensor nodes."
                    onPress={() => setDevices(true)}
                  />
                )}
                <ToolCard
                  testID="settings-calibration"
                  icon={Thermometer}
                  title="Sensor calibration"
                  copy="Record calibration status for reporting nodes."
                  onPress={() => setMaintenance('calibration')}
                />
                <ToolCard
                  testID="settings-software"
                  icon={Gauge}
                  title="Device software"
                  copy="Review firmware and simulated update history."
                  onPress={() => setMaintenance('software')}
                />
                <ToolCard
                  testID="settings-diagnostics"
                  icon={TriangleAlert}
                  title="Hub and diagnostics"
                  copy="Inspect connectivity, device status and saved events."
                  onPress={() => setMaintenance('diagnostics')}
                />
                {canPreviewOwner && (
                  <ToolCard
                    testID="preview-owner-interface"
                    icon={Eye}
                    tone="blue"
                    title="View farm owner interface"
                    copy={`Read-only preview for the scanned farm ${target.code}.`}
                    onPress={onPreviewOwner}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <AccountSheet visible={account} onClose={() => setAccount(false)} />
      {farm.toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: insets.bottom + 18,
            left: 18,
            right: 18,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.greenDark,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 13,
              maxWidth: 520,
            }}
          >
            <Label style={{ color: '#fff', fontSize: 13 }}>{farm.toast}</Label>
          </View>
        </View>
      )}
    </View>
  );
}
