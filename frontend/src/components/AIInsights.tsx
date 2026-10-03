import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AudioLines, ChartNoAxesCombined, ChevronRight } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Label, Sheet, styles } from './ui';
import { InspectionNotes } from './FarmManagement';

export function AIInsights() {
  const { aiState, context, data } = useFarm();
  const [detail, setDetail] = useState<'environment' | 'sound' | null>(null);
  const [about, setAbout] = useState(false);
  const unavailable = aiState === 'unavailable' || context.connection === 'offline';
  const soundConsentRecorded = data.site.survey?.ai.audioConsent === 'yes';
  if (!data.site.survey)
    return (
      <Card style={{ gap: 6 }}>
        <Label weight="bold">Insights</Label>
        <Label style={{ color: colors.muted }}>
          The technician survey determines which environmental and sound data can be collected.
        </Label>
      </Card>
    );
  return (
    <View style={{ gap: 12 }}>
      <Label weight="bold">Insights & inspection notes</Label>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {(['environment', 'sound'] as const).map((kind) => {
          const Icon = kind === 'environment' ? ChartNoAxesCombined : AudioLines;
          return (
            <Pressable
              key={kind}
              testID={`ai-${kind}`}
              accessibilityRole="button"
              onPress={() => {
                setDetail(kind);
                setAbout(false);
              }}
              style={[styles.row, { padding: 16 }]}
            >
              <Icon size={22} color={colors.green} />
              <View style={{ flex: 1, gap: 3 }}>
                <Label weight="bold">
                  {kind === 'environment' ? en.environmentAI : en.soundAI}
                </Label>
                <Label style={{ fontSize: 12, color: colors.muted }}>
                  {kind === 'sound'
                    ? 'Coming soon · hub model is not trained'
                    : unavailable
                      ? en.aiUnavailable
                      : en.aiCollecting}
                </Label>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </Card>
      <Sheet
        visible={detail !== null}
        title={detail === 'sound' ? en.soundAI : en.environmentAI}
        onClose={() => setDetail(null)}
      >
        <View style={{ gap: 16 }}>
          <Label style={{ color: colors.muted }}>
            {detail === 'sound'
              ? `Sound analysis is coming soon while the hub model is being trained. ${soundConsentRecorded ? 'No audio is processed or stored by this simulation.' : 'Owner consent will be required before sound collection can be enabled.'}`
              : 'AI results are not available yet. You can record your own observations below.'}
          </Label>
          {detail && <InspectionNotes key={detail} kind={detail} />}
          <Button variant="ghost" onPress={() => setAbout(!about)}>
            {about ? 'Hide AI details' : 'About these insights'}
          </Button>
          {about && (
            <>
              <Label>{en.aiCollectingNote}</Label>
              <Label>{detail === 'sound' ? en.soundAIBody : en.environmentAIBody}</Label>
              <Label>{en.aiSteps}</Label>
              <Label style={{ color: colors.muted }}>{en.aiLocal}</Label>
            </>
          )}
        </View>
      </Sheet>
    </View>
  );
}
