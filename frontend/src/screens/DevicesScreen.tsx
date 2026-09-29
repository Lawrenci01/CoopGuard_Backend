import { useState } from 'react';
import { Pressable, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import {
  ChevronRight,
  Cpu,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { en, relativeTime } from '../i18n/en';
import { colors, fonts } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { canManageSensors } from '../domain/policy';
import type { Sensor } from '../domain/types';
import { Button, Card, Chip, Choice, Label, SectionTitle, Sheet, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { AddSensorWizard, SensorSheet } from '../components/FarmSheets';

export function DevicesScreen() {
  const { snapshot, context, now, notifications, toggleNotifications } = useFarm();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [sensor, setSensor] = useState<Sensor | null>(null),
    [wizard, setWizard] = useState(false),
    [info, setInfo] = useState<{ title: string; body: string } | null>(null);
  const sensors = snapshot.sensors.filter(
    (s) =>
      (filter !== 'check' || !s.online) &&
      `${en.sensor} ${s.number} ${en.section} ${s.section}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const settings: {
    title: string;
    body: string;
    icon: LucideIcon;
    restricted?: boolean;
    tag?: string;
  }[] = [
    {
      title: en.calibration,
      body: en.calibrationBody,
      icon: SlidersHorizontal,
      restricted: context.role !== 'technician',
      tag: en.technicianOnly,
    },
    {
      title: en.software,
      body: en.softwareBody,
      icon: ShieldCheck,
      restricted: context.role !== 'technician',
      tag: en.technicianOnly,
    },
    {
      title: en.people,
      body: en.peopleBody,
      icon: Users,
      restricted: context.role !== 'owner',
      tag: en.ownerOnly,
    },
    { title: en.diagnostics, body: en.diagnosticsBody, icon: Wrench },
  ];
  return (
    <ScreenFrame
      tab="Devices"
      action={
        <View style={{ gap: 4 }}>
          <Button
            testID="add-sensor"
            disabled={!canManageSensors(context)}
            icon={Plus}
            onPress={() => setWizard(true)}
          >
            {en.addSensor}
          </Button>
          {!canManageSensors(context) && (
            <Label style={{ fontSize: 10, color: colors.muted }}>
              {context.role !== 'technician' ? en.technicianOnly : en.localOnly}
            </Label>
          )}
        </View>
      }
    >
      <Card style={{ backgroundColor: '#EDF2E7' }}>
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <View style={{ backgroundColor: '#DCE8D2', padding: 15, borderRadius: 17 }}>
            <Cpu size={32} color={colors.green} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Label weight="bold" style={{ fontSize: 21 }}>
              {en.hub}
            </Label>
            <Label style={{ color: colors.muted, fontSize: 12 }}>{en.hubDescription}</Label>
            <View style={{ marginTop: 8 }}>
              <Chip tone={context.connection === 'local' ? 'green' : 'muted'} dot>
                {context.connection === 'local' ? en.hubWorking : en.savedStatus}
              </Chip>
            </View>
          </View>
          <Chip tone="muted">{en.previewOnly}</Chip>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginTop: 24 }}>
          <View style={{ gap: 5 }}>
            <Label style={{ color: colors.muted, fontSize: 12 }}>{en.power}</Label>
            <Label weight="bold">{en.hubPower}</Label>
          </View>
          <View style={{ gap: 5 }}>
            <Label style={{ color: colors.muted, fontSize: 12 }}>{en.hubInternet}</Label>
            <Label weight="bold">{en.internetUnavailable}</Label>
          </View>
          <View style={{ gap: 5 }}>
            <Label style={{ color: colors.muted, fontSize: 12 }}>{en.sync}</Label>
            <Label weight="bold">{relativeTime(snapshot.syncedAt, now)}</Label>
          </View>
        </View>
        <Label style={{ marginTop: 18, color: colors.muted, fontSize: 12 }}>
          {en.storedLocally}
        </Label>
      </Card>
      <View>
        <SectionTitle title={en.sensors} subtitle={en.sensorsReporting} />
        <View
          style={{
            flexDirection: wide ? 'row' : 'column',
            gap: 12,
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              flex: 1,
              maxWidth: wide ? 340 : undefined,
            }}
          >
            <Search size={17} color={colors.muted} />
            <TextInput
              accessibilityLabel={en.searchSensors}
              placeholder={en.searchSensors}
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={{
                flex: 1,
                minHeight: 44,
                fontSize: 13,
                fontFamily: fonts.regular,
                color: colors.ink,
              }}
            />
          </View>
          <Choice
            values={['all', 'check']}
            selected={filter}
            labels={{ all: en.all, check: en.needsCheck }}
            onSelect={setFilter}
          />
        </View>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {sensors.length === 0 && (
            <View style={{ padding: 25, gap: 10 }}>
              <Label weight="bold">{en.noSensors}</Label>
              <Label style={{ color: colors.muted }}>{en.noSensorsBody}</Label>
              <Button
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                {en.clearSearch}
              </Button>
            </View>
          )}
          {(['A', 'B', 'C'] as const).map((section) => {
            const group = sensors.filter((s) => s.section === section);
            if (!group.length) return null;
            return (
              <View key={section}>
                <View
                  style={{ backgroundColor: '#F0F3EA', paddingVertical: 9, paddingHorizontal: 20 }}
                >
                  <Label
                    weight="bold"
                    style={{ fontSize: 11, color: colors.muted, letterSpacing: 1 }}
                  >
                    {en.section.toUpperCase()} {section}
                  </Label>
                </View>
                {group.map((s) => (
                  <Pressable
                    key={s.id}
                    testID={`device-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${en.sensor} ${s.number}, ${s.online ? en.online : en.offline}`}
                    onPress={() => setSensor(s)}
                    style={({ hovered, pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 18,
                      gap: 14,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: hovered || pressed ? '#F7F9F3' : '#fff',
                    })}
                  >
                    <View
                      style={{
                        padding: 10,
                        backgroundColor: s.online ? colors.greenSoft : '#F0F1ED',
                        borderRadius: 12,
                      }}
                    >
                      <Radio size={20} color={s.online ? colors.green : colors.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Label weight="bold">
                        {en.sensor} {s.number}
                      </Label>
                      <Label style={{ color: colors.muted, fontSize: 11 }}>
                        {s.control ? en.controlsFans : en.sensingOnly}
                      </Label>
                    </View>
                    {wide && (
                      <>
                        <Label style={{ width: 85 }}>
                          {s.online ? `${s.readings.temperature.toFixed(1)}°C` : '—'}
                        </Label>
                        <Label style={{ width: 85, color: colors.muted }}>{en[s.signal]}</Label>
                        <Label style={{ width: 90, color: colors.muted }}>
                          {s.battery === null ? en.pluggedIn : `${s.battery}%`}
                        </Label>
                      </>
                    )}
                    <Chip tone={s.online ? 'green' : 'muted'} dot>
                      {s.online ? en.online : en.offline}
                    </Chip>
                    <ChevronRight size={17} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            );
          })}
        </Card>
      </View>
      <View>
        <SectionTitle title={en.settings} />
        <Card style={{ gap: 16 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Label weight="bold">{en.notifications}</Label>
              <Label style={{ fontSize: 12, color: colors.muted, maxWidth: 650 }}>
                {en.notificationsBody}
              </Label>
            </View>
            <Switch
              accessibilityLabel={en.notifications}
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#D5DBD0', true: '#A2C396' }}
              thumbColor={notifications ? colors.green : '#fff'}
            />
          </View>
          <View style={styles.divider} />
          {settings.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              onPress={() =>
                setInfo({
                  title: item.title,
                  body: item.restricted ? `${item.tag}. ${item.body}` : item.body,
                })
              }
              style={[styles.row, { minHeight: 44 }]}
            >
              <item.icon color={colors.green} size={19} />
              <Label weight="medium" style={{ flex: 1 }}>
                {item.title}
              </Label>
              {item.restricted && (
                <Label style={{ color: colors.muted, fontSize: 10 }}>{item.tag}</Label>
              )}
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      </View>
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
      <Sheet visible={!!info} title={info?.title ?? ''} onClose={() => setInfo(null)}>
        <Label>{info?.body}</Label>
      </Sheet>
      {wizard && <AddSensorWizard visible onClose={() => setWizard(false)} />}
    </ScreenFrame>
  );
}
