import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { ArrowRight, Check, Pencil } from 'lucide-react-native';
import {
  type HouseSurveyDraft,
  validSurvey,
  surveyRecommendation,
  suggestedSections,
} from '../domain/setup';
import { en } from '../i18n/en';
import { colors, fonts } from '../theme';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Chip, Choice, Label } from './ui';

export function HouseSetupForm({ onDone }: { onDone: () => void }) {
  const { survey, saveSurvey } = useFarm();
  const [farmName, setFarmName] = useState(survey?.farmName ?? '');
  const [houseName, setHouseName] = useState(survey?.houseName ?? '');
  const [houseType, setHouseType] = useState<HouseSurveyDraft['houseType']>(
    survey?.houseType ?? 'unknown',
  );
  const [controller, setController] = useState<HouseSurveyDraft['controller']>(
    survey?.controller ?? 'unknown',
  );
  const [flock, setFlock] = useState<HouseSurveyDraft['flock']>(survey?.flock ?? 'unknown');
  const [length, setLength] = useState(survey ? String(survey.lengthMetres) : '');
  const [width, setWidth] = useState(survey ? String(survey.widthMetres) : '');
  const [review, setReview] = useState(false),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const draft: HouseSurveyDraft = {
    farmName: farmName.trim(),
    houseName: houseName.trim(),
    houseType,
    controller,
    flock,
    lengthMetres: Number(length),
    widthMetres: Number(width),
  };
  const inputStyle = {
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 15,
  };
  return (
    <View style={{ gap: 20 }}>
      <Label style={{ color: colors.muted }}>{en.setupBody}</Label>
      {review ? (
        <>
          <Chip tone="amber">{en.draftOnly}</Chip>
          <Card style={{ gap: 12 }}>
            <Label weight="bold" style={{ fontSize: 22, lineHeight: 29 }}>
              {draft.farmName}
            </Label>
            <Label>
              {draft.houseName} · {en.houseTypes[draft.houseType]}
            </Label>
            <Label>
              {draft.lengthMetres} m × {draft.widthMetres} m
            </Label>
            <Label>
              {en.suggestedSections}: {suggestedSections(draft)}
            </Label>
            <Label>{en.surveyOutcome[surveyRecommendation(draft)]}</Label>
          </Card>
          <Label>{en.draftChecks}</Label>
          <Label style={{ color: colors.muted }}>{en.draftSeparate}</Label>
          <Button
            icon={Check}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              if (await saveSurvey(draft)) onDone();
              setBusy(false);
            }}
          >
            {en.saveDraft}
          </Button>
          <Button icon={Pencil} variant="secondary" onPress={() => setReview(false)}>
            {en.editDraft}
          </Button>
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Label weight="bold">{en.farmLabel}</Label>
            <TextInput
              accessibilityLabel={en.farmLabel}
              value={farmName}
              onChangeText={setFarmName}
              maxLength={80}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label weight="bold">{en.houseLabel}</Label>
            <TextInput
              accessibilityLabel={en.houseLabel}
              value={houseName}
              onChangeText={setHouseName}
              maxLength={80}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label weight="bold">{en.houseTypeLabel}</Label>
            <Choice
              values={['open', 'tunnel', 'unknown']}
              selected={houseType}
              labels={en.houseTypes}
              onSelect={setHouseType}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label weight="bold">{en.controllerLabel}</Label>
            <Choice
              values={['present', 'absent', 'unknown']}
              selected={controller}
              labels={en.controllerOptions}
              onSelect={setController}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label weight="bold">{en.flockLabel}</Label>
            <Choice
              values={['broiler', 'layer', 'unknown']}
              selected={flock}
              labels={en.flockOptions}
              onSelect={setFlock}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Label>{en.lengthLabel}</Label>
              <TextInput
                accessibilityLabel={en.lengthLabel}
                value={length}
                onChangeText={setLength}
                keyboardType="decimal-pad"
                maxLength={8}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Label>{en.widthLabel}</Label>
              <TextInput
                accessibilityLabel={en.widthLabel}
                value={width}
                onChangeText={setWidth}
                keyboardType="decimal-pad"
                maxLength={8}
                style={inputStyle}
              />
            </View>
          </View>
          {error && (
            <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
              {en.setupInvalid}
            </Label>
          )}
          <Button
            icon={ArrowRight}
            onPress={() => {
              if (!validSurvey(draft)) {
                setError(true);
                return;
              }
              setError(false);
              setReview(true);
            }}
          >
            {en.reviewDraft}
          </Button>
        </>
      )}
    </View>
  );
}
