import { useCallback, useState } from 'react';
import { BackHandler, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, Radio, Search } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors, fonts } from '../theme';
import { useFarm } from '../state/FarmProvider';
import type { Sensor } from '../domain/types';
import { Button, Card, Chip, Choice, Label, styles } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { SensorSheet } from '../components/FarmSheets';
import { HouseSetupForm } from '../components/HouseSetupForm';
import { FlockManager, Maintenance } from '../components/FarmManagement';
import { WorkerAccounts } from '../components/WorkerAccounts';
import { OwnerSiteSummary, SiteWorkflowPanel } from '../components/SiteWorkflowPanel';
import { DeviceSimulationPanel } from '../components/DeviceSimulationPanel';
import { houseGrid } from '../domain/houseLayout';

type Panel =
  | 'farm'
  | 'sensors'
  | 'survey'
  | 'setup'
  | 'people'
  | 'calibration'
  | 'software'
  | 'diagnostics';
const titles: Record<Panel, string> = {
  farm: 'Farm',
  sensors: 'Devices',
  survey: 'Site survey',
  setup: 'Complete site survey',
  people: 'Worker accounts',
  calibration: en.calibration,
  software: en.software,
  diagnostics: 'Hub & diagnostics',
};

export function DevicesScreen() {
  const { snapshot, context, data, previewMode } = useFarm();
  const technician = context.role === 'technician';
  const [panel, setPanel] = useState<Panel>(technician ? 'sensors' : 'farm');
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const homePanel: Panel = technician ? 'sensors' : 'farm';
  const goBack = useCallback(() => setPanel(homePanel), [homePanel]);
  useFocusEffect(
    useCallback(() => {
      if (panel === homePanel) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [panel, homePanel, goBack]),
  );
  const sensors = snapshot.sensors.filter(
    (s) =>
      (filter !== 'check' || !s.online) &&
      `${en.sensor} ${s.number} ${en.section} ${s.section}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const house = data.site.survey?.house ?? data.house;
  const layout = houseGrid(house?.lengthMetres ?? 90, house?.widthMetres ?? 12);
  const sectionList = Array.from(
    new Set([...layout.sections, ...sensors.map((item) => item.section)]),
  );
  return (
    <ScreenFrame
      key={panel}
      tab="Devices"
      title={titles[panel]}
      subtitle={panel === 'farm' ? 'Profile, flock and people' : undefined}
      action={
        panel === 'sensors' && technician ? (
          <Button
            testID="site-survey"
            compact
            variant="secondary"
            onPress={() => setPanel('survey')}
          >
            Site survey
          </Button>
        ) : undefined
      }
    >
      {panel !== homePanel && (
        <Button testID="settings-back" compact variant="ghost" onPress={goBack}>
          ← {technician ? 'Devices' : 'Farm management'}
        </Button>
      )}
      {panel === 'farm' && context.role === 'owner' && (
        <>
          <OwnerSiteSummary />
          {previewMode ? (
            <Card style={{ padding: 16, gap: 6, backgroundColor: colors.blueSoft }}>
              <Label weight="bold">Read-only owner preview</Label>
              <Label style={{ color: colors.muted }}>
                Flock and worker-account changes are hidden while a technician previews this farm.
              </Label>
            </Card>
          ) : (
            <>
              {data.site.survey ? <FlockManager /> : null}
              <Card style={{ padding: 16, gap: 8 }}>
                {(['people'] as const).map((item) => (
                  <Pressable
                    key={item}
                    testID={`settings-${item}`}
                    accessibilityRole="button"
                    onPress={() => setPanel(item)}
                    style={[styles.row, { minHeight: 48 }]}
                  >
                    <Label style={{ flex: 1 }}>{titles[item]}</Label>
                    <ChevronRight size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </Card>
            </>
          )}
        </>
      )}
      {panel === 'survey' && technician && (
        <>
          <SiteWorkflowPanel onEdit={() => setPanel('setup')} />
          <Card style={{ padding: 16, gap: 8 }}>
            {(['calibration', 'software', 'diagnostics'] as const).map((item) => (
              <Pressable
                key={item}
                testID={`settings-${item}`}
                accessibilityRole="button"
                onPress={() => setPanel(item)}
                style={[styles.row, { minHeight: 48 }]}
              >
                <Label style={{ flex: 1 }}>{titles[item]}</Label>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </>
      )}
      {panel === 'setup' && technician && <HouseSetupForm onDone={() => setPanel('survey')} />}
      {panel === 'people' && context.role === 'owner' && <WorkerAccounts />}
      {context.role === 'technician' &&
        (panel === 'calibration' || panel === 'software' || panel === 'diagnostics') && (
          <Maintenance mode={panel} />
        )}
      {panel === 'sensors' && technician && (
        <>
          <DeviceSimulationPanel />
          <Card style={{ padding: 16, gap: 8 }}>
            {(['calibration', 'software', 'diagnostics'] as const).map((item) => (
              <Pressable
                key={item}
                testID={`settings-${item}`}
                accessibilityRole="button"
                onPress={() => setPanel(item)}
                style={[styles.row, { minHeight: 48 }]}
              >
                <Label style={{ flex: 1 }}>{titles[item]}</Label>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </>
      )}
      {panel === 'sensors' && !technician && (
        <>
          <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <Label style={{ color: colors.muted }}>
              {snapshot.sensors.filter((s) => s.online).length} of {snapshot.sensors.length} nodes
              reporting
            </Label>
          </View>
          <View
            style={[
              styles.row,
              {
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
              },
            ]}
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
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {sensors.length === 0 && (
              <View style={{ padding: 20, gap: 10 }}>
                <Label>{en.noSensors}</Label>
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
            {sectionList.map((section) => {
              const group = sensors.filter((s) => s.section === section);
              if (!group.length) return null;
              return (
                <View key={section}>
                  <Label
                    weight="bold"
                    style={{
                      backgroundColor: '#F0F3EA',
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      fontSize: 11,
                      color: colors.muted,
                    }}
                  >
                    {en.section} {section}
                  </Label>
                  {group.map((s) => (
                    <Pressable
                      key={s.id}
                      testID={`device-${s.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${en.sensor} ${s.number}, ${s.online ? en.online : en.offline}`}
                      onPress={() => setSensor(s)}
                      style={[
                        styles.row,
                        { padding: 16, borderBottomWidth: 1, borderColor: colors.border },
                      ]}
                    >
                      <Radio size={20} color={s.online ? colors.green : colors.muted} />
                      <Label weight="medium" style={{ flex: 1 }}>
                        {en.sensor} {s.number}
                      </Label>
                      <Chip tone={s.online ? 'green' : 'amber'}>
                        {s.online ? en.online : en.offline}
                      </Chip>
                      <ChevronRight size={17} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </Card>
        </>
      )}
      <SensorSheet sensor={sensor} onClose={() => setSensor(null)} />
    </ScreenFrame>
  );
}
