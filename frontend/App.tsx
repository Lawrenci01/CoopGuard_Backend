import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  Bird,
  ChartNoAxesCombined,
  House,
  LayoutDashboard,
  Map,
  Radio,
  RefreshCw,
  Settings2,
  Wifi,
  Cloud,
  WifiOff,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react-native';
import { en, relativeTime } from './src/i18n/en';
import { colors, fonts } from './src/theme';
import type { TabName } from './src/domain/types';
import { FarmProvider, useFarm } from './src/state/FarmProvider';
import { Chip, IconButton, Label, styles } from './src/components/ui';
import { PreviewSheet } from './src/components/FarmSheets';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { HeatMapScreen } from './src/screens/HeatMapScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { DevicesScreen } from './src/screens/DevicesScreen';

const Tabs = createBottomTabNavigator<Record<TabName, undefined>>();
const icons: Record<TabName, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Alerts: Bell,
  'Heat Map': Map,
  Analytics: ChartNoAxesCombined,
  Devices: Radio,
};

function Navigation({
  state,
  navigation,
  onPreview,
}: BottomTabBarProps & { onPreview: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 950;
  const { snapshot } = useFarm();
  const count = snapshot.alerts.filter((alert) => alert.status === 'active').length;
  const links = state.routes.map((route, index) => {
    const name = route.name as TabName,
      active = state.index === index,
      Icon = icons[name];
    return (
      <Pressable
        key={route.key}
        testID={`nav-${name.replace(' ', '-')}`}
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
        style={({ hovered, pressed }) => [
          wide ? appStyles.sideLink : appStyles.bottomLink,
          active && { backgroundColor: wide ? colors.greenSoft : 'transparent' },
          (hovered || pressed) && !active && { backgroundColor: '#F5F7F1' },
        ]}
      >
        <View>
          <Icon
            size={wide ? 21 : 22}
            color={active ? colors.green : colors.muted}
            strokeWidth={active ? 2 : 1.65}
          />
          {!wide && name === 'Alerts' && count > 0 && <View style={appStyles.notificationDot} />}
        </View>
        <Label
          weight={active ? 'bold' : 'medium'}
          style={{
            flex: wide ? 1 : undefined,
            fontSize: wide ? 13 : 9,
            lineHeight: 15,
            color: active ? colors.green : colors.muted,
          }}
        >
          {en.nav[name]}
        </Label>
        {wide && name === 'Alerts' && count > 0 && (
          <View
            style={{
              backgroundColor: '#E9D9B9',
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Label weight="bold" style={{ color: colors.amber, fontSize: 10, lineHeight: 15 }}>
              {count}
            </Label>
          </View>
        )}
      </Pressable>
    );
  });
  if (!wide)
    return (
      <View style={[appStyles.bottomNav, { paddingBottom: Math.max(insets.bottom, 9) }]}>
        {links}
      </View>
    );
  return (
    <View style={appStyles.sidebar}>
      <View>
        <View style={[styles.row, { marginBottom: 44, gap: 10 }]}>
          <View
            style={{
              backgroundColor: colors.green,
              width: 37,
              height: 40,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bird size={24} color="#fff" strokeWidth={1.7} />
          </View>
          <Label
            weight="bold"
            style={{ fontSize: 23, color: colors.greenDark, letterSpacing: -0.8 }}
          >
            {en.brand}
          </Label>
        </View>
        <Label
          weight="bold"
          style={{
            color: '#98A194',
            fontSize: 9,
            letterSpacing: 1.8,
            marginBottom: 12,
            paddingLeft: 14,
          }}
        >
          {en.house.toUpperCase()}
        </Label>
        <View style={{ gap: 7 }}>{links}</View>
      </View>
      <View style={{ gap: 22 }}>
        <View style={{ backgroundColor: '#F1F4EB', borderRadius: 16, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
            <Radio size={18} color={colors.green} />
            <View
              style={{
                width: 17,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#92A883',
              }}
            />
            <Wifi size={18} color={colors.green} />
            <View
              style={{
                width: 17,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#92A883',
              }}
            />
            <House size={18} color={colors.green} />
          </View>
          <Label weight="bold" style={{ fontSize: 13, lineHeight: 19 }}>
            {en.localFirst}
          </Label>
          <Label style={{ fontSize: 11, lineHeight: 17, color: colors.muted }}>
            {en.localFirstText}
          </Label>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en.previewSettings}
          testID="preview-settings-sidebar"
          onPress={onPreview}
          style={[styles.row, { paddingHorizontal: 8, minHeight: 44 }]}
        >
          <Settings2 size={19} color={colors.muted} />
          <Label style={{ flex: 1, color: colors.muted, fontSize: 12 }}>{en.previewSettings}</Label>
          <ArrowUpRight size={16} color={colors.muted} />
        </Pressable>
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 17 }}>
          <Label style={{ color: '#9AA294', fontSize: 10 }}>{en.tagline}</Label>
        </View>
      </View>
    </View>
  );
}

function AppHeader({ onPreview, onAlerts }: { onPreview: () => void; onAlerts: () => void }) {
  const { context, snapshot, now, refresh } = useFarm();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 600;
  const ConnectionIcon =
    context.connection === 'local' ? Wifi : context.connection === 'cloud' ? Cloud : WifiOff;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: compact ? 18 : 32,
        paddingTop: Math.max(insets.top, 17),
        paddingBottom: 15,
        gap: 12,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={[styles.row, { gap: 12 }]}>
          <View
            style={{
              width: 36,
              height: 36,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <House size={19} color={colors.green} />
          </View>
          <View>
            <Label weight="bold" style={{ fontSize: 13 }}>
              {!compact && (
                <>
                  {en.farmName}
                  <Label style={{ color: colors.muted }}> / </Label>
                </>
              )}
              {en.house}
            </Label>
            <Label style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>{en.flock}</Label>
          </View>
          {!compact && <Chip tone="muted">{en.preview}</Chip>}
        </View>
        <View style={{ flexDirection: 'row', gap: compact ? 0 : 8, alignItems: 'center' }}>
          {!compact && (
            <Pressable
              testID="connection-status"
              accessibilityRole="button"
              onPress={onPreview}
              style={[styles.row, { marginRight: 8, gap: 6 }]}
            >
              <ConnectionIcon
                size={15}
                color={context.connection === 'local' ? colors.green : colors.amber}
              />
              <Label
                weight="medium"
                style={{
                  color: context.connection === 'local' ? colors.green : colors.amber,
                  fontSize: 11,
                }}
              >
                {en.connection[context.connection]}
              </Label>
            </Pressable>
          )}
          {!compact && <IconButton icon={RefreshCw} label={en.refresh} onPress={refresh} />}
          <IconButton icon={Bell} label={en.nav.Alerts} onPress={onAlerts} />
          <Pressable
            testID="preview-settings"
            accessibilityRole="button"
            accessibilityLabel={en.previewSettings}
            onPress={onPreview}
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 22,
              backgroundColor: colors.greenSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Label weight="bold" style={{ fontSize: 12, color: colors.green }}>
              {en.role[context.role].slice(0, 1)}
            </Label>
          </Pressable>
        </View>
      </View>
      {compact && (
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Pressable accessibilityRole="button" onPress={onPreview} style={styles.row}>
            <ConnectionIcon size={13} color={colors.green} />
            <Label style={{ fontSize: 10, color: colors.green }}>
              {en.connection[context.connection]}
            </Label>
          </Pressable>
          <Chip tone="muted">{en.preview}</Chip>
        </View>
      )}
      {context.connection !== 'local' && (
        <Label accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 11 }}>
          {en.connectionHelp[context.connection]} · {en.readingsAsOf}:{' '}
          {relativeTime(
            context.connection === 'cloud' ? snapshot.syncedAt : snapshot.sampledAt,
            now,
          )}
        </Label>
      )}
    </View>
  );
}

function AppContent() {
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState(false);
  const { toast } = useFarm();
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
        linking={{
          prefixes: ['coopguard://'],
          config: {
            screens: {
              Dashboard: '',
              Alerts: 'alerts',
              'Heat Map': 'house-map',
              Analytics: 'trends',
              Devices: 'devices',
            },
          },
        }}
      >
        <Tabs.Navigator
          tabBar={(props) => <Navigation {...props} onPreview={() => setPreview(true)} />}
          screenOptions={({ navigation }) => ({
            tabBarPosition: width >= 950 ? 'left' : 'bottom',
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
      <PreviewSheet visible={preview} onClose={() => setPreview(false)} />
      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: width < 950 ? 92 : 28,
            left: 24,
            right: 24,
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

export default function App() {
  const [loaded, error] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  if (!loaded && !error)
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
  sidebar: {
    width: 228,
    backgroundColor: '#FDFEF9',
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 22,
    justifyContent: 'space-between',
  },
  sideLink: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomNav: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
  },
  bottomLink: { flex: 1, minHeight: 47, alignItems: 'center', justifyContent: 'center', gap: 5 },
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
});
