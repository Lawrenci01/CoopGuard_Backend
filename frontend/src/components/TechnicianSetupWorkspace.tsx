import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HouseSetupForm } from './HouseSetupForm';
import { SiteWorkflowPanel } from './SiteWorkflowPanel';
import { AccountSheet } from './AccountSheet';
import { Button, Chip, Label } from './ui';
import { useAuth } from '../state/AuthProvider';
import { useFarm } from '../state/FarmProvider';
import { colors } from '../theme';
import { relativeTime } from '../i18n/en';

export function TechnicianSetupWorkspace() {
  const auth = useAuth();
  const farm = useFarm();
  const insets = useSafeAreaInsets();
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [account, setAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const target = auth.record!.session.farms.find((item) => item.id === auth.record!.farmId)!;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 30,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Chip tone="blue">TECHNICIAN SETUP</Chip>
              <Label weight="bold" style={{ fontSize: 25, lineHeight: 33 }}>
                {target.name}
              </Label>
              <Label style={{ color: colors.muted }}>Farm ID {target.code}</Label>
              <Label
                testID="connection-status"
                style={{ color: farm.connected ? colors.muted : colors.amber, fontSize: 12 }}
              >
                {farm.syncing
                  ? 'Syncing setup records…'
                  : farm.connected
                    ? `${auth.activeConnection === 'hub' ? 'Farm hub' : 'Cloud'} · synced ${relativeTime(farm.lastSyncedAt, farm.now).toLowerCase()}`
                    : 'Server unavailable · saved setup records'}
              </Label>
            </View>
            <Button compact variant="secondary" onPress={() => setAccount(true)}>
              Account
            </Button>
          </View>

          <Label style={{ color: colors.muted }}>
            This workspace contains installation records only. Farm readings, operational alerts,
            and the house map remain hidden from the technician setup flow.
          </Label>

          {editingSurvey ? (
            <HouseSetupForm onDone={() => setEditingSurvey(false)} />
          ) : (
            <SiteWorkflowPanel onEdit={() => setEditingSurvey(true)} />
          )}
        </View>
      </ScrollView>
      <AccountSheet visible={account} onClose={() => setAccount(false)} />
      {farm.toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', bottom: insets.bottom + 18, left: 18, right: 18, alignItems: 'center' }}
        >
          <View style={{ backgroundColor: colors.greenDark, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 13, maxWidth: 520 }}>
            <Label style={{ color: '#fff', fontSize: 13 }}>{farm.toast}</Label>
          </View>
        </View>
      )}
    </View>
  );
}
