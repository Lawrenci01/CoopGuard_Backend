import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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
  House,
  LayoutDashboard,
  Map,
  Radio,
  Wifi,
  Cloud,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { en, relativeTime } from './src/i18n/en';
import { colors, fonts } from './src/theme';
import type { TabName } from './src/domain/types';
import { FarmProvider, useFarm } from './src/state/FarmProvider';
import { Button, Chip, IconButton, Label, styles } from './src/components/ui';
import { flockDay } from './src/services/localFarmRepository';
import { PreviewSheet } from './src/components/FarmSheets';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { HeatMapScreen } from './src/screens/HeatMapScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { DevicesScreen } from './src/screens/DevicesScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

const Tabs = createBottomTabNavigator<Record<TabName, undefined>>();
const icons: Record<TabName, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Alerts: Bell,
  'Heat Map': Map,
  Analytics: ChartNoAxesCombined,
  Devices: Radio,
};

function Navigation({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { snapshot } = useFarm();
  const count = snapshot.alerts.filter((alert) => alert.status === 'active').length;
  return (
    <View style={[appStyles.bottomNav, { paddingBottom: Math.max(insets.bottom, 9) }]}>
      {state.routes.map((route, index) => {
        const name = route.name as TabName,
          active = state.index === index,
          Icon = icons[name];
        return (
          <Pressable
            key={route.key}
            testID={'nav-' + name.replace(' ', '-')}
            accessibilityRole="tab"
            accessibilityLabel={en.nav[name]}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [
              appStyles.bottomLink,
              pressed && { backgroundColor: colors.greenSoft },
            ]}
          >
            <View>
              <Icon
                size={23}
                color={active ? colors.green : colors.muted}
                strokeWidth={active ? 2 : 1.65}
              />
              {name === 'Alerts' && count > 0 && <View style={appStyles.notificationDot} />}
            </View>
            <Label
              weight={active ? 'bold' : 'medium'}
              style={{
                fontSize: 11,
                lineHeight: 16,
                textAlign: 'center',
                color: active ? colors.green : colors.muted,
              }}
            >
              {en.nav[name]}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

function AppHeader({ onPreview, onAlerts }: { onPreview: () => void; onAlerts: () => void }) {
  const { context, snapshot, now, data } = useFarm();
  const insets = useSafeAreaInsets();
  const ConnectionIcon =
    context.connection === 'local' ? Wifi : context.connection === 'cloud' ? Cloud : WifiOff;
  const connectionColor = context.connection === 'local' ? colors.green : colors.amber;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 18,
        paddingTop: insets.top + 10,
        paddingBottom: 8,
        gap: 4,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={[styles.row, { flex: 1 }]}>
          <View style={appStyles.houseIcon}>
            <House size={20} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Label weight="bold" style={{ fontSize: 15 }}>
              {data.house?.houseName ?? en.house}
            </Label>
            <Label style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              {data.flock
                ? `${data.house ? en.flockOptions[data.house.flock] : 'Broiler'} · Day ${flockDay(data.flock, now)} of ${data.flock.days}`
                : 'No active flock'}
            </Label>
          </View>
        </View>
        <IconButton icon={Bell} label={en.nav.Alerts} onPress={onAlerts} />
        <Pressable
          testID="preview-settings"
          accessibilityRole="button"
          accessibilityLabel={en.previewSettings}
          onPress={onPreview}
          style={appStyles.avatar}
        >
          <Label weight="bold" style={{ fontSize: 13, color: colors.green }}>
            {en.role[context.role].slice(0, 1)}
          </Label>
        </Pressable>
      </View>
      <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }]}>
        <Pressable
          testID="connection-status"
          accessibilityRole="button"
          onPress={onPreview}
          style={[styles.row, { minHeight: 44, gap: 6 }]}
        >
          <ConnectionIcon size={14} color={connectionColor} />
          <Label style={{ fontSize: 11, color: connectionColor }}>
            {en.connection[context.connection]}
          </Label>
        </Pressable>
        <Chip tone="muted">{en.preview}</Chip>
      </View>
      {context.connection !== 'local' && (
        <Label
          accessibilityLiveRegion="polite"
          style={{ color: colors.amber, fontSize: 11, paddingBottom: 6 }}
        >
          {en.connectionHelp[context.connection]} · {en.readingsAsOf}:{' '}
          {relativeTime(snapshot.sampledAt, now)}
        </Label>
      )}
    </View>
  );
}

function AppContent() {
  const [preview, setPreview] = useState(false);
  const { toast, ready, started, loadError, retryLoad } = useFarm();
  const insets = useSafeAreaInsets();
  if (!ready) return <Loading />;
  if (loadError)
    return (
      <View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 20 }}>
        <Label weight="bold">Could not open saved farm data</Label>
        <Label>{loadError}</Label>
        <Label>Your saved data has been kept. Try opening it again.</Label>
        <Button onPress={retryLoad}>Try again</Button>
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      {!started ? (
        <OnboardingScreen />
      ) : (
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
            screenOptions={({ navigation }) => ({
              tabBarPosition: 'bottom',
              animation: 'none',
              header: () => (
                <AppHeader
                  onPreview={() => setPreview(true)}
                  onAlerts={() => navigation.navigate('Alerts')}
                />
              ),
              sceneStyle: { backgroundColor: colors.background },
            })}
          >
            <Tabs.Screen name="Dashboard" component={DashboardScreen} />
            <Tabs.Screen name="Alerts" component={AlertsScreen} />
            <Tabs.Screen name="Heat Map" component={HeatMapScreen} />
            <Tabs.Screen name="Analytics" component={AnalyticsScreen} />
            <Tabs.Screen name="Devices" component={DevicesScreen} />
          </Tabs.Navigator>
        </NavigationContainer>
      )}
      <PreviewSheet visible={preview} onClose={() => setPreview(false)} />
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
      <FarmProvider>
        <AppContent />
      </FarmProvider>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  bottomNav: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
  },
  bottomLink: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 3,
  },
  notificationDot: {
    position: 'absolute',
    right: -3,
    top: -2,
    width: 7,
    height: 7,
    backgroundColor: colors.amber,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  houseIcon: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
