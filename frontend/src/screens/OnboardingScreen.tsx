import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Bird, ClipboardList, Wifi } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { BarnIllustration } from '../components/BarnIllustration';
import { HouseSetupForm } from '../components/HouseSetupForm';
import { Button, Card, Chip, Label, styles } from '../components/ui';

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { enterDemo } = useFarm();
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    if (!setup) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSetup(false);
      return true;
    });
    return () => subscription.remove();
  }, [setup]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ width: '100%', maxWidth: 550, alignSelf: 'center', gap: 22 }}>
          <View style={styles.row}>
            <View style={{ backgroundColor: colors.green, padding: 10, borderRadius: 14 }}>
              <Bird color="#fff" size={25} />
            </View>
            <Label weight="bold" style={{ fontSize: 25, lineHeight: 33, color: colors.greenDark }}>
              {en.brand}
            </Label>
          </View>
          {setup ? (
            <>
              <Label weight="bold" style={{ fontSize: 30, lineHeight: 38 }}>
                {en.setupTitle}
              </Label>
              <HouseSetupForm onDone={() => setSetup(false)} />
              <Button variant="ghost" onPress={() => setSetup(false)}>
                {en.back}
              </Button>
            </>
          ) : (
            <>
              <View
                style={{ height: 215, backgroundColor: '#EAF0E1', borderRadius: 28, padding: 10 }}
              >
                <BarnIllustration />
              </View>
              <Label
                weight="bold"
                style={{ fontSize: 34, lineHeight: 43, letterSpacing: -1, color: colors.greenDark }}
              >
                {en.welcome}
              </Label>
              <Label style={{ fontSize: 16, lineHeight: 25, color: colors.muted }}>
                {en.welcomeBody}
              </Label>
              <Card style={{ backgroundColor: colors.greenSoft }}>
                <View style={[styles.row, { alignItems: 'flex-start' }]}>
                  <Wifi color={colors.green} size={22} />
                  <Label style={{ flex: 1 }}>{en.welcomeLocal}</Label>
                </View>
              </Card>
              <Chip tone="amber">{en.previewOnly}</Chip>
              <Label style={{ color: colors.muted, fontSize: 12 }}>{en.sampleSignIn}</Label>
              <Button testID="enter-demo" icon={ArrowRight} onPress={enterDemo}>
                {en.welcomeDemo}
              </Button>
              <Button
                testID="start-setup"
                variant="secondary"
                icon={ClipboardList}
                onPress={() => setSetup(true)}
              >
                {en.prepareHouse}
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
