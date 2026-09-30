import { useState } from 'react';
import { View } from 'react-native';
import { AudioLines, ChartNoAxesCombined, ChevronRight } from 'lucide-react-native';
import { en } from '../i18n/en';
import { colors } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Chip, Label, SectionTitle, Sheet, styles } from './ui';
import { InspectionNotes } from './FarmManagement';

export function AIInsights() {
  const { aiState, context } = useFarm();
  const [detail, setDetail] = useState<'environment' | 'sound' | null>(null);
  const unavailable = aiState === 'unavailable' || context.connection === 'offline';
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title={en.aiTitle} subtitle={en.aiLocal} />
      {(['environment', 'sound'] as const).map((kind) => {
        const Icon = kind === 'environment' ? ChartNoAxesCombined : AudioLines;
        return (
          <Card key={kind} style={{ gap: 12, backgroundColor: '#EFF3E9' }}>
            <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Icon size={24} color={colors.green} />
              <Chip tone="muted">{unavailable ? en.aiUnavailable : en.aiCollecting}</Chip>
            </View>
            <Label weight="bold" style={{ fontSize: 20, lineHeight: 27 }}>
              {kind === 'environment' ? en.environmentAI : en.soundAI}
            </Label>
            <Label style={{ color: colors.muted }}>
              {unavailable
                ? en.aiUnavailableBody
                : kind === 'environment'
                  ? en.environmentAIBody
                  : en.soundAIBody}
            </Label>
            <Button variant="ghost" compact icon={ChevronRight} onPress={() => setDetail(kind)}>
              {en.aiAbout}
            </Button>
          </Card>
        );
      })}
      <Sheet
        visible={detail !== null}
        title={detail === 'sound' ? en.soundAI : en.environmentAI}
        onClose={() => setDetail(null)}
      >
        <View style={{ gap: 18 }}>
          <Label>{en.aiCollectingNote}</Label>
          <Label>{en.aiSteps}</Label>
          <Label style={{ color: colors.muted }}>{en.aiLocal}</Label>
          {detail === 'sound' && <Label>{en.soundAIBody}</Label>}
          {detail && <InspectionNotes key={detail} kind={detail} />}
        </View>
      </Sheet>
    </View>
  );
}
