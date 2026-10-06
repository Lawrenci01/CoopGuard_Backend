import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import {
  Bell,
  ChartNoAxesCombined,
  CheckCircle2,
  House,
  LayoutDashboard,
  Map,
  Radio,
  NotebookPen,
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
import { flockDay } from './src/services/localFarmRepository';
import { deviceSetupProgress } from './src/domain/deviceSimulation';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { HeatMapScreen } from './src/screens/HeatMapScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { DevicesScreen } from './src/screens/DevicesScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { TechnicianFarmSelector } from './src/components/TechnicianFarmSelector';
import { TechnicianSetupWorkspace } from './src/components/TechnicianSetupWorkspace';
import { AdminScreen } from './src/screens/AdminScreen';

const Tabs = createBottomTabNavigator<Record<TabName, undefined>>();
const icons: Record<TabName, LucideIcon> = {
  Dashboard: LayoutDashboard,
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
        paddingBottom: Math.max(insets.bottom, 9),
        flexDirection: 'row',
      }}
    >
      {state.routes.map((route, index) => {
        const name = route.name as TabName,
          active = state.index === index,
          Icon = name === 'Devices' && context.role === 'owner' ? House : icons[name];
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
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingHorizontal: 3,
            }}
          >
            <View>
              <Icon size={23} color={active ? colors.green : colors.muted} />
              {name === 'Alerts' && count > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -3,
                    top: -2,
                    width: 7,
                    height: 7,
                    borderRadius: 5,
                    backgroundColor: colors.amber,
                  }}
                />
              )}
            </View>
            <Label
              weight={active ? 'bold' : 'medium'}
              style={{
                fontSize: 11,
                lineHeight: 16,
                color: active ? colors.green : colors.muted,
                textAlign: 'center',
              }}
            >
              {label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}
function Header({ onAccount }: { onAccount: () => void }) {
  const { data, context, now, syncing, connected, lastSyncedAt, pendingCount, readingSource } =
      useFarm(),
    auth = useAuth(),
    insets = useSafeAreaInsets();
  const r = auth.record!;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 18,
        paddingTop: insets.top + 10,
        paddingBottom: 8,
        gap: 6,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <House size={23} color={colors.green} />
        <View style={{ flex: 1 }}>
          <Label weight="bold" style={{ fontSize: 15 }}>
            {data.house?.houseName ??
              r.session.farms.find((f) => f.id === r.farmId)?.name ??
              'Your farm'}
          </Label>
          <Label style={{ fontSize: 11, color: colors.muted }}>
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
          style={{ minHeight: 44, justifyContent: 'center', gap: 3 }}
        >
          <Chip tone={readingSource === 'telemetry' ? 'green' : 'muted'}>
            {readingSource === 'telemetry'
              ? connected
                ? 'TELEMETRY'
                : 'SAVED TELEMETRY'
              : 'SAMPLE READINGS'}
          </Chip>
          <Label weight="medium" style={{ fontSize: 11, color: colors.green, textAlign: 'right' }}>
            {en.role[context.role]} · Account
          </Label>
        </Pressable>
      </View>
      <Label
        testID="connection-status"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 11, color: connected ? colors.muted : colors.amber }}
      >
        {syncing
          ? 'Syncing with farm server…'
          : connected
            ? `${auth.activeConnection === 'hub' ? 'Farm hub' : 'Cloud'} - synced ${relativeTime(lastSyncedAt, now).toLowerCase()}`
            : 'Server unavailable · saved data'}
        {pendingCount ? ` · ${pendingCount} note(s) waiting` : ''}
      </Label>
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
function FarmApp() {
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
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Label weight="bold" style={{ fontSize: 21 }}>
                {farm.name}
              </Label>
              <Label style={{ color: colors.muted }}>Farm ID {farm.code}</Label>
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
            header: () => <Header onAccount={() => setAccount(true)} />,
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
  const [selected, setSelected] = useState(false);
  const r = auth.record!;
  if (!selected) return <TechnicianFarmSelector onSelected={() => setSelected(true)} />;
  return (
    <FarmProvider key={`${auth.server}:${r.session.account.id}:${r.farmId}:technician`}>
      <TechnicianSetupWorkspace />
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
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.green} />
    </View>
  );
}
export default function App() {
  const [loaded, error] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
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
