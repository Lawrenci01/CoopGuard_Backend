import { useState } from 'react';
import { InspectionNotes } from '../components/FarmManagement';
import { Choice } from '../components/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { useFarm } from '../state/FarmProvider';

export function NotesScreen() {
  const { data } = useFarm();
  const [kind, setKind] = useState<'environment' | 'sound'>('environment');
  const soundEnabled =
    !!data.site.survey?.sensors.microphone && data.site.survey.ai.audioConsent === 'yes';
  const availableKinds: ('environment' | 'sound')[] = soundEnabled
    ? ['environment', 'sound']
    : ['environment'];
  const selectedKind = soundEnabled ? kind : 'environment';

  return (
    <ScreenFrame tab="Notes" title="Daily observations">
      <Choice
        values={availableKinds}
        selected={selectedKind}
        labels={{ environment: 'House conditions', sound: 'Flock sounds' }}
        onSelect={setKind}
      />
      <InspectionNotes key={selectedKind} kind={selectedKind} />
    </ScreenFrame>
  );
}
