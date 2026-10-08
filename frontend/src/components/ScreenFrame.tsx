import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import type { TabName } from '../domain/types';
import { Label, styles } from './ui';
import { useFarm } from '../state/FarmProvider';

export function ScreenFrame({
  tab,
  children,
  action,
  title,
  subtitle,
  hideTitle = false,
}: React.PropsWithChildren<{
  tab: TabName;
  action?: React.ReactNode;
  title?: string;
  subtitle?: string;
  hideTitle?: boolean;
}>) {
  const { refresh } = useFarm();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      testID={`screen-${tab.replace(' ', '-')}`}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          colors={[colors.green]}
          tintColor={colors.green}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await refresh();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
      contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 }}>
        {!hideTitle && (
          <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Label
                accessibilityRole="header"
                weight="bold"
                style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }}
              >
                {title ?? (tab === 'Dashboard' ? 'Today' : en.nav[tab])}
              </Label>
              {subtitle && (
                <Label style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {subtitle}
                </Label>
              )}
            </View>
            {action}
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}
