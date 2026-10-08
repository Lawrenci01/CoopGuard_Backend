import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import {
  Bell,
  ChartNoAxesCombined,
  CheckCircle2,
  Eye,
  House,
  Map,
  Radio,
  NotebookPen,
  Warehouse,
  type LucideIcon,
} from 'lucide-react-native';
import { en, relativeTime } from './src/i18n/en';
import { colors, fonts } from './src/theme';
import type { TabName } from './src/domain/types';
import { roleTabs } from './src/domain/roles';
import { AuthProvider, useAuth } from './src/state/AuthProvider';
import { FarmProvider, useFarm } from './src/state/FarmProvider';
import { Button, Card, Chip, Label, styles } from './src/components/ui';
import { AccountSheet } from './src/components/AccountSheet';
import { BrandMark } from './src/components/Brand';
import { flockDay } from './src/services/localFarmRepository';
import { deviceSetupProgress } from './src/domain/deviceSimulation';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { HeatMapScreen } from './src/screens/HeatMapScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { DevicesScreen } from './src/screens/DevicesScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import {
  TechnicianFarmSelector,
  type TechnicianFarmSelection,
} from './src/components/TechnicianFarmSelector';
import { TechnicianSetupWorkspace } from './src/components/TechnicianSetupWorkspace';
import { AdminScreen } from './src/screens/AdminScreen';

const Tabs = createBottomTabNavigator<Record<TabName, undefined>>();
const icons: Record<TabName, LucideIcon> = {
  Dashboard: House,
  Alerts: Bell,
  'Heat Map': Map,
  Analytics: ChartNoAxesCombined,
  Devices: Radio,
  Notes: NotebookPen,
};
function Navigation({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets(),
    { snapshot, context } = useFarm();
  const count = snapshot.alerts.filter((a) => a.status !== 'resolved').length;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 14),
        flexDirection: 'row',
        minHeight: 76,
      }}
    >
      {state.routes.map((route, index) => {
        const name = route.name as TabName,
          active = state.index === index,
          Icon = name === 'Devices' && context.role === 'owner' ? Warehouse : icons[name];
        const label = name === 'Devices' && context.role === 'owner' ? 'Farm' : en.nav[name];
        return (
          <Pressable
            key={route.key}
            testID={`nav-${name.replace(' ', '-')}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingHorizontal: 3,
            }}
          >
            <View>
              <Icon size={21} color={active ? colors.green : '#89908B'} strokeWidth={1.8} />
              {name === 'Alerts' && count > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -10,
                    top: -6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: colors.red,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Label weight="bold" style={{ color: '#fff', fontSize: 8, lineHeight: 10 }}>
                    {count}
                  </Label>
                </View>
              )}
            </View>
            <Label
              weight="bold"
              style={{
                fontSize: 9,
                lineHeight: 13,
                color: active ? colors.green : '#89908B',
                textAlign: 'center',
              }}
            >
              {label}
            </Label>
            {active && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 21,
                  height: 2,
                  borderRadius: 2,
                  backgroundColor: colors.green,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
function Header({ onAccount }: { onAccount: () => void }) {
  const { data, now, syncing, connected, lastSyncedAt, pendingCount, readingSource } = useFarm(),
    auth = useAuth(),
    insets = useSafeAreaInsets();
  const r = auth.record!;
  const farm = r.session.farms.find((item) => item.id === r.farmId);
  const initials = r.session.account.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={[
          styles.row,
          {
            justifyContent: 'space-between',
            backgroundColor: colors.greenDark,
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: 18,
          },
        ]}
      >
        <BrandMark size={46} />
        <View style={{ flex: 1 }}>
          <Label style={{ fontSize: 10, color: '#FFFFFF9E' }}>
            COOPGUARD {'\u00B7'} {farm?.code ?? 'FARM'}
          </Label>
          <Label weight="bold" style={{ fontSize: 19, lineHeight: 25, color: '#FFFFFF' }}>
            {data.house?.farmName ?? farm?.name ?? 'Your farm'}
          </Label>
          <Label style={{ fontSize: 10, color: '#FFFFFFB8' }}>
            {data.flock
              ? `Day ${flockDay(data.flock, now)} · ${data.flock.birds.toLocaleString()} birds`
              : 'No active flock'}
          </Label>
        </View>
        <Pressable
          testID="account-menu"
          accessibilityRole="button"
          accessibilityLabel="Your account"
          onPress={onAccount}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF1F',
            borderWidth: 1,
            borderColor: '#FFFFFF33',
            borderRadius: 12,
          }}
        >
          <Label weight="bold" style={{ color: '#FFFFFF', fontSize: 11 }}>
            {initials}
          </Label>
        </Pressable>
      </View>
      <View
        style={{
          minHeight: 40,
          paddingHorizontal: 20,
          paddingVertical: 7,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Chip tone={connected ? 'green' : 'muted'}>
          {auth.activeConnection === 'hub' ? 'Farm hub' : connected ? 'Cloud' : 'Offline'}
        </Chip>
        <Chip
          tone={
            readingSource === 'hardware'
              ? 'green'
              : readingSource === 'simulated'
                ? 'blue'
                : 'muted'
          }
        >
          {readingSource === 'hardware'
            ? 'Hardware'
            : readingSource === 'simulated'
              ? 'Simulated'
              : 'Sample'}
        </Chip>
        <Label
          testID="connection-status"
          accessibilityLiveRegion="polite"
          style={{
            flex: 1,
            fontSize: 8,
            color: connected ? colors.muted : colors.amber,
            textAlign: 'right',
          }}
        >
          {syncing
            ? 'Syncing with farm server…'
            : connected
              ? `${auth.activeConnection === 'hub' ? 'Farm hub' : 'Cloud'} - synced ${relativeTime(lastSyncedAt, now).toLowerCase()}`
              : 'Server unavailable · saved data'}
          {pendingCount ? ` · ${pendingCount} note(s) waiting` : ''}
        </Label>
      </View>
    </View>
  );
}
const components = {
  Dashboard: DashboardScreen,
  Alerts: AlertsScreen,
  'Heat Map': HeatMapScreen,
  Analytics: AnalyticsScreen,
  Devices: DevicesScreen,
  Notes: NotesScreen,
};
function OwnerPreviewBanner({ farmCode, onExit }: { farmCode: string; onExit: () => void }) {
  return (
    <View
      testID="owner-preview-banner"
      style={{
        backgroundColor: colors.blueSoft,
        borderBottomWidth: 1,
        borderColor: '#CFE0EC',
        paddingHorizontal: 18,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <Eye size={18} color={colors.blue} />
      <View style={{ flex: 1 }}>
        <Label weight="bold" style={{ fontSize: 11 }}>
          Owner interface preview
        </Label>
        <Label style={{ color: colors.muted, fontSize: 9 }}>
          Scanned farm {farmCode} · read-only
        </Label>
      </View>
      <Button testID="exit-owner-preview" compact variant="secondary" onPress={onExit}>
        Exit preview
      </Button>
    </View>
  );
}

function FarmApp({
  ownerPreview,
  previewFarmCode,
  onExitOwnerPreview,
}: {
  ownerPreview?: boolean;
  previewFarmCode?: string;
  onExitOwnerPreview?: () => void;
} = {}) {
  const { toast, ready, loadError, retryLoad, context, data } = useFarm(),
    auth = useAuth(),
    insets = useSafeAreaInsets();
  const [account, setAccount] = useState(false);
  if (!ready) return <Loading />;
  if (loadError)
    return (
      <View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 20 }}>
        <Label weight="bold">Could not open your farm</Label>
        <Label>{loadError}</Label>
        <Button onPress={() => void retryLoad()}>Try again</Button>
        <Button variant="ghost" onPress={() => void auth.logout()}>
          Sign out
        </Button>
      </View>
    );
  const deviceProgress = deviceSetupProgress(data.site, data.deviceSimulation);
  const houseActivated = ['normal_monitor', 'normal_control'].includes(data.site.status);
  if (context.role !== 'technician' && (!deviceProgress.ready || !houseActivated)) {
    const farm = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;
    const steps = [
      { label: 'Technician survey completed', done: !!data.site.survey },
      {
        label: 'Farm hub paired and reporting',
        done: data.deviceSimulation.hub?.status === 'reporting',
      },
      {
        label: `${deviceProgress.requiredNodes} planned node(s) paired`,
        done:
          deviceProgress.requiredNodes > 0 &&
          deviceProgress.reportingNodes >= deviceProgress.requiredNodes,
      },
      { label: 'Installation commissioned and activated', done: houseActivated },
    ];
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 18,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 18,
        }}
      >
        <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', gap: 18 }}>
          {ownerPreview && previewFarmCode && onExitOwnerPreview && (
            <OwnerPreviewBanner farmCode={previewFarmCode} onExit={onExitOwnerPreview} />
          )}
          <View
            style={[
              styles.row,
              {
                justifyContent: 'space-between',
                backgroundColor: colors.greenDark,
                borderRadius: 18,
                padding: 18,
              },
            ]}
          >
            <BrandMark size={50} />
            <View style={{ flex: 1, gap: 3 }}>
              <Label style={{ color: '#FFFFFF9E', fontSize: 10 }}>Farm setup</Label>
              <Label weight="bold" style={{ fontSize: 21, color: '#FFFFFF' }}>
                {farm.name}
              </Label>
              <Label style={{ color: '#FFFFFFB8' }}>Farm ID {farm.code}</Label>
            </View>
            <Button compact variant="secondary" onPress={() => setAccount(true)}>
              Account
            </Button>
          </View>
          <Card style={{ gap: 12, padding: 20 }}>
            <Chip tone="amber">SETUP IN PROGRESS</Chip>
            <Label weight="bold" style={{ fontSize: 22, lineHeight: 29 }}>
              CoopGuard is being prepared for this house
            </Label>
            <Label>
              Your monitoring, trends, alerts and equipment functions will appear after the
              technician completes the survey, pairs the planned hub and nodes, and activates the
              installation.
            </Label>
            {steps.map((step) => (
              <View key={step.label} style={styles.row}>
                <CheckCircle2 size={19} color={step.done ? colors.green : colors.muted} />
                <Label style={{ flex: 1, color: step.done ? colors.ink : colors.muted }}>
                  {step.label}
                </Label>
              </View>
            ))}
          </Card>
        </View>
        <AccountSheet visible={account} onClose={() => setAccount(false)} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.surface,
            primary: colors.green,
            text: colors.ink,
            border: colors.border,
          },
          fonts: {
            regular: { fontFamily: fonts.regular, fontWeight: '400' },
            medium: { fontFamily: fonts.medium, fontWeight: '500' },
            bold: { fontFamily: fonts.bold, fontWeight: '700' },
            heavy: { fontFamily: fonts.bold, fontWeight: '700' },
          },
        }}
      >
        <Tabs.Navigator
          tabBar={(props) => <Navigation {...props} />}
          screenOptions={{
            tabBarPosition: 'bottom',
            animation: 'none',
            header: () => (
              <>
                <Header onAccount={() => setAccount(true)} />
                {ownerPreview && previewFarmCode && onExitOwnerPreview && (
                  <OwnerPreviewBanner farmCode={previewFarmCode} onExit={onExitOwnerPreview} />
                )}
              </>
            ),
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          {roleTabs[context.role].map((name) => (
            <Tabs.Screen key={name} name={name} component={components[name]} />
          ))}
        </Tabs.Navigator>
      </NavigationContainer>
      <AccountSheet visible={account} onClose={() => setAccount(false)} />
      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: insets.bottom + 82,
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
            <Label style={{ color: '#fff', fontSize: 13 }}>{toast}</Label>
          </View>
        </View>
      )}
    </View>
  );
}
function SessionGate() {
  const auth = useAuth();
  if (!auth.ready) return <Loading />;
  if (!auth.record || auth.record.session.account.mustChangePassword) return <LoginScreen />;
  const r = auth.record;
  if (r.session.account.role === 'admin') return <AdminScreen />;
  if (r.session.account.role === 'technician')
    return <TechnicianSession key={`${r.session.account.id}:${r.session.token}`} />;
  return (
    <FarmProvider
      key={`${auth.server}:${r.session.account.id}:${r.farmId}:${r.session.account.role}`}
    >
      <FarmApp />
    </FarmProvider>
  );
}
function TechnicianSession() {
  const auth = useAuth();
  const [selection, setSelection] = useState<TechnicianFarmSelection | null>(null);
  const [ownerPreview, setOwnerPreview] = useState(false);
  const r = auth.record!;
  if (!selection) return <TechnicianFarmSelector onSelected={setSelection} />;
  const target = r.session.farms.find((farm) => farm.id === r.farmId);
  const canPreviewOwner =
    selection.method === 'qr' && !!target && target.code.toUpperCase() === selection.farmCode;
  const showingOwnerPreview = ownerPreview && canPreviewOwner;
  return (
    <FarmProvider
      key={`${auth.server}:${r.session.account.id}:${r.farmId}:technician`}
      roleOverride={showingOwnerPreview ? 'owner' : undefined}
      readOnly={showingOwnerPreview}
    >
      {showingOwnerPreview ? (
        <FarmApp
          ownerPreview
          previewFarmCode={selection.farmCode}
          onExitOwnerPreview={() => setOwnerPreview(false)}
        />
      ) : (
        <TechnicianSetupWorkspace
          canPreviewOwner={canPreviewOwner}
          onPreviewOwner={() => setOwnerPreview(true)}
        />
      )}
    </FarmProvider>
  );
}
function Loading() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
        backgroundColor: colors.background,
      }}
    >
      <BrandMark size={64} />
      <ActivityIndicator color={colors.green} />
    </View>
  );
}
export default function App() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold });
  if (!loaded && !error) return <Loading />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <SessionGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
