import React from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { en, relativeTime } from '../i18n/en';
import { colors } from '../theme';
import type { TabName } from '../domain/types';
import { Label } from './ui';
import { useFarm } from '../state/FarmProvider';

export function ScreenFrame({
  tab,
  children,
  action,
}: React.PropsWithChildren<{ tab: TabName; action?: React.ReactNode }>) {
  const { width } = useWindowDimensions();
  const small = width < 600;
  const { snapshot, now } = useFarm();
  return (
    <ScrollView
      testID={`screen-${tab.replace(' ', '-')}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: small ? 18 : 32, paddingBottom: 36 }}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ width: '100%', maxWidth: 1330, alignSelf: 'center', gap: 24 }}>
        <View
          style={{
            flexDirection: small ? 'column' : 'row',
            gap: 14,
            alignItems: small ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <View style={{ flex: 1 }}>
            <Label
              weight="bold"
              style={{ color: colors.muted, fontSize: 10, letterSpacing: 1.7, marginBottom: 7 }}
            >
              {en.pages[tab].eyebrow}
            </Label>
            <Label
              accessibilityRole="header"
              weight="bold"
              style={{
                color: colors.ink,
                fontSize: small ? 29 : 35,
                lineHeight: small ? 37 : 44,
                letterSpacing: -1.1,
              }}
            >
              {en.pages[tab].title}
            </Label>
            <Label style={{ color: colors.muted, fontSize: 13, marginTop: 7, maxWidth: 600 }}>
              {en.pages[tab].subtitle}
            </Label>
          </View>
          {action}
        </View>
        <Label style={{ color: colors.muted, fontSize: 11 }}>
          {en.previewDescription} {en.readingsAsOf}: {relativeTime(snapshot.sampledAt, now)}
        </Label>
        {children}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 18,
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Label style={{ color: colors.muted, fontSize: 11 }}>{en.previewDescription}</Label>
          <Label style={{ color: colors.muted, fontSize: 11 }}>
            {en.brand} · {en.logout}
          </Label>
        </View>
      </View>
    </ScrollView>
  );
}
