import { useState } from 'react';
import { Share, TextInput, View } from 'react-native';
import type { Section, Sensor } from '../domain/types';
import { colors, fonts } from '../theme';
import { dateText, flockDay, type Inspection } from '../services/localFarmRepository';
import { useFarm } from '../state/FarmProvider';
import { Button, Card, Choice, Label, SectionTitle, Sheet } from './ui';
import { relativeTime } from '../i18n/en';
import { useAuth } from '../state/AuthProvider';

export function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label weight="medium">{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline={multiline}
        maxLength={multiline ? 2000 : 80}
        style={{
          fontFamily: fonts.regular,
          color: colors.ink,
          fontSize: 15,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 13,
          minHeight: multiline ? 100 : 50,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function FlockManager({ nextStep = false }: { nextStep?: boolean }) {
  const { data, now, context, perform } = useFarm();
  const [open, setOpen] = useState(false),
    [ending, setEnding] = useState(false),
    [busy, setBusy] = useState(false);
  const [startDate, setDate] = useState(dateText()),
    [days, setDays] = useState('42'),
    [birds, setBirds] = useState('');
  const manager = context.role === 'owner';
  return (
    <Card style={{ gap: 12 }}>
      <Label weight="bold" style={{ fontSize: 18 }}>
        {nextStep ? 'House saved. Add your flock' : 'Flock cycle'}
      </Label>
      <Label>
        {data.flock
          ? `Day ${flockDay(data.flock, now)} of ${data.flock.days} · ${data.flock.birds.toLocaleString()} birds`
          : nextStep
            ? 'Enter the start date and bird count to begin tracking this cycle.'
            : 'No active flock'}
      </Label>
      {data.flock && <Label>Started {data.flock.startDate}</Label>}
      <Button testID="open-flock" variant="secondary" onPress={() => setOpen(true)}>
        {nextStep ? 'Add flock details' : 'Manage flock'}
      </Button>
      <Sheet
        visible={open}
        title="Flock cycle"
        onClose={() => {
          setOpen(false);
          setEnding(false);
        }}
      >
        <View style={{ gap: 18 }}>
          {!manager && <Label>The farm owner manages flock cycles.</Label>}
          {data.flock ? (
            <>
              <Label weight="bold">
                {data.flock.birds.toLocaleString()} birds · started {data.flock.startDate}
              </Label>
              <Label>
                Ending this cycle saves its dates, bird count, and alert count. Equipment
                settings stay as they are.
              </Label>
              {ending ? (
                <>
                  <Label weight="bold">End this flock now?</Label>
                  <Button
                    testID="confirm-end-flock"
                    variant="danger"
                    disabled={busy || !manager}
                    onPress={async () => {
                      setBusy(true);
                      if (await perform({ type: 'endFlock' }, 'Flock ended and saved.'))
                        setEnding(false);
                      setBusy(false);
                    }}
                  >
                    Confirm end flock
                  </Button>
                  <Button variant="ghost" onPress={() => setEnding(false)}>
                    Keep current flock
                  </Button>
                </>
              ) : (
                <Button
                  testID="end-flock"
                  disabled={!manager}
                  variant="secondary"
                  onPress={() => setEnding(true)}
                >
                  End current flock
                </Button>
              )}
            </>
          ) : (
            <>
              <Field label="Start date (YYYY-MM-DD)" value={startDate} onChange={setDate} />
              <Field label="Expected days" value={days} onChange={setDays} numeric />
              <Field label="Number of birds" value={birds} onChange={setBirds} numeric />
              <Button
                testID="start-flock"
                disabled={busy || !manager}
                onPress={async () => {
                  setBusy(true);
                  if (
                    await perform(
                      { type: 'startFlock', startDate, days: Number(days), birds: Number(birds) },
                      'New flock saved.',
                    )
                  )
                    setOpen(false);
                  setBusy(false);
                }}
              >
                Start new flock
              </Button>
            </>
          )}
          {data.pastFlocks.length > 0 && <SectionTitle title="Completed cycles" />}
          {data.pastFlocks.map((flock) => (
            <Card key={flock.id} style={{ gap: 6 }}>
              <Label weight="bold">
                {flock.startDate} → {dateText(flock.endedAt)}
              </Label>
              <Label>
                {flock.birds.toLocaleString()} birds · {flock.alertCount ?? 0} alerts
              </Label>
            </Card>
          ))}
        </View>
      </Sheet>
    </Card>
  );
}

export function InspectionNotes({ kind }: { kind: Inspection['kind'] }) {
  const auth = useAuth();
  const { data, perform, now, notify } = useFarm();
  const [text, setText] = useState(''),
    [editing, setEditing] = useState<string | undefined>(),
    [deleting, setDeleting] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const notes = data.inspections.filter((n) => n.kind === kind);
  return (
    <View style={{ gap: 16 }}>
      <SectionTitle title="Inspection notes" />
      <Label>
        Record what you observed. Notes save on this phone even without a network. They are human
        observations, not AI results.
      </Label>
      <Field label="What did you notice?" value={text} onChange={setText} multiline />
      <Button
        testID="save-inspection"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          if (
            await perform({ type: 'saveInspection', id: editing, kind, text }, 'Inspection saved.')
          ) {
            setText('');
            setEditing(undefined);
          }
          setBusy(false);
        }}
      >
        {editing ? 'Save changes' : 'Save inspection'}
      </Button>
      {editing && (
        <Button
          variant="ghost"
          onPress={() => {
            setEditing(undefined);
            setText('');
          }}
        >
          Cancel edit
        </Button>
      )}
      {notes.length > 0 && (
        <Button
          variant="secondary"
          onPress={async () => {
            try {
              await Share.share({
                title: 'CoopGuard inspection notes',
                message: notes
                  .map((n) => `${new Date(n.createdAt).toLocaleString()} · ${n.kind}\n${n.text}`)
                  .join('\n\n'),
              });
            } catch {
              notify('Could not open sharing. Your notes are still saved.');
            }
          }}
        >
          Export these notes
        </Button>
      )}
      {notes.map((note) => (
        <Card key={note.id} style={{ gap: 10 }}>
          <Label style={{ color: colors.muted }}>{relativeTime(note.createdAt, now)}</Label>
          <Label>{note.text}</Label>
          {note.pending && (
            <Label style={{ color: colors.amber }}>Saved on this phone · waiting to sync</Label>
          )}
          {!!note.authorName && (
            <Label style={{ fontSize: 12, color: colors.muted }}>{note.authorName}</Label>
          )}
          {!note.pending &&
            (auth.record?.session.account.role === 'owner' ||
              note.authorId === auth.record?.session.account.id) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  compact
                  variant="secondary"
                  onPress={() => {
                    setText(note.text);
                    setEditing(note.id);
                  }}
                >
                  Edit note
                </Button>
                <Button compact variant="ghost" onPress={() => setDeleting(note.id)}>
                  Delete note
                </Button>
              </View>
            )}
          {deleting === note.id && (
            <>
              <Label>Delete this saved note?</Label>
              <Button
                variant="danger"
                onPress={async () => {
                  if (await perform({ type: 'deleteInspection', id: note.id }, 'Note deleted.')) {
                    setDeleting(null);
                    if (editing === note.id) {
                      setEditing(undefined);
                      setText('');
                    }
                  }
                }}
              >
                Confirm delete
              </Button>
              <Button variant="ghost" onPress={() => setDeleting(null)}>
                Keep note
              </Button>
            </>
          )}
        </Card>
      ))}
    </View>
  );
}

export function SensorEditor({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const { perform } = useFarm();
  const [section, setSection] = useState<Section>(sensor.section),
    [position, setPosition] = useState(
      sensor.y < 0.4 ? 'front' : sensor.y > 0.6 ? 'back' : 'middle',
    ),
    [remove, setRemove] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 16 }}>
      <SectionTitle title="Sensor placement" />
      <Choice
        values={['A', 'B', 'C']}
        labels={{ A: 'Section A', B: 'Section B', C: 'Section C' }}
        selected={section}
        onSelect={setSection}
      />
      <Choice
        values={['front', 'middle', 'back']}
        labels={{ front: 'Front', middle: 'Middle', back: 'Back' }}
        selected={position}
        onSelect={setPosition}
      />
      <Button
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          if (
            await perform(
              {
                type: 'moveSensor',
                id: sensor.id,
                section,
                x: (['A', 'B', 'C'].indexOf(section) + 0.5) / 3,
                y: position === 'front' ? 0.25 : position === 'back' ? 0.75 : 0.5,
              },
              'Sensor position saved.',
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        Save position
      </Button>
      {remove ? (
        <>
          <Label>
            Remove this sensor from the current map? Its record and previous alerts stay in the
            archive.
          </Label>
          <Button
            variant="danger"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              if (await perform({ type: 'retireSensor', id: sensor.id }, 'Sensor retired.'))
                onClose();
              setBusy(false);
            }}
          >
            Confirm remove sensor
          </Button>
          <Button variant="ghost" onPress={() => setRemove(false)}>
            Keep sensor
          </Button>
        </>
      ) : (
        <Button variant="ghost" onPress={() => setRemove(true)}>
          Remove sensor
        </Button>
      )}
    </View>
  );
}

export function Maintenance({ mode }: { mode: 'calibration' | 'diagnostics' | 'software' }) {
  const { data, snapshot, context, perform, now } = useFarm();
  if (mode === 'software')
    return (
      <View style={{ gap: 14 }}>
        <Label weight="bold">Simulated device firmware</Label>
        <Label style={{ color: colors.muted }}>
          Firmware actions update saved simulator state only. They do not install software on
          physical hardware.
        </Label>
        {[
          ...(data.deviceSimulation.hub ? [data.deviceSimulation.hub] : []),
          ...data.deviceSimulation.nodes,
        ].map((device) => (
          <Card key={device.id} style={{ gap: 8 }}>
            <Label weight="bold">{device.id}</Label>
            <Label>
              {device.status} · firmware {device.firmwareVersion ?? '0.1.0-sim'}
            </Label>
            {device.firmwareUpdatedAt && (
              <Label style={{ color: colors.muted }}>
                Updated {relativeTime(device.firmwareUpdatedAt, now)}
              </Label>
            )}
            <Button
              variant="secondary"
              disabled={context.role !== 'technician' || device.status !== 'reporting'}
              onPress={() =>
                void perform(
                  { type: 'updateVirtualFirmware', id: device.id },
                  'Simulated firmware update saved.',
                )
              }
            >
              Simulate firmware update
            </Button>
          </Card>
        ))}
        {!data.deviceSimulation.hub && !data.deviceSimulation.nodes.length && (
          <Label>No farm devices have been created yet.</Label>
        )}
        <Label weight="bold">Recent device history</Label>
        {data.deviceSimulation.history.slice(0, 8).map((event) => (
          <Label key={event.id} style={{ color: colors.muted }}>
            {event.deviceId} · {event.details} · {relativeTime(event.createdAt, now)}
          </Label>
        ))}
      </View>
    );
  if (mode === 'diagnostics')
    return (
      <View style={{ gap: 12 }}>
        <Label weight="bold">Local data store: available</Label>
        <Label>
          {snapshot.sensors.filter((s) => s.online).length} of {snapshot.sensors.length} nodes
          reporting
        </Label>
        <Label>
          {snapshot.alerts.filter((a) => a.status !== 'resolved').length} unresolved alerts
        </Label>
        <Label>Sound analysis: coming soon while the hub AI model is being trained.</Label>
        <Label>
          Hub: {data.deviceSimulation.hub?.status ?? 'not created'}
          {data.deviceSimulation.hub ? ` · ${data.deviceSimulation.hub.id}` : ''}
        </Label>
        <Label>
          {data.deviceSimulation.nodes.filter((node) => node.status === 'reporting').length} of{' '}
          {data.deviceSimulation.nodes.length} virtual nodes reporting
        </Label>
        <Label>
          {data.deviceSimulation.history.length} simulated maintenance event(s) recorded
        </Label>
        <Label>{data.retired.length} retired sensor records retained</Label>
        {data.retired.map((s) => (
          <Label key={s.id}>
            Node {s.number} · Section {s.section} · last temperature{' '}
            {s.readings.temperature.toFixed(1)} °C
          </Label>
        ))}
      </View>
    );
  return (
    <View style={{ gap: 14 }}>
      <Label>
        Record a simulated calibration for a reporting node. Physical calibration still requires the
        approved technician procedure and hardware.
      </Label>
      {snapshot.sensors.map((sensor) => (
        <Card key={sensor.id} style={{ gap: 8 }}>
          <Label weight="bold">Node {sensor.number}</Label>
          <Label>
            {data.calibration[sensor.id]
              ? `Simulated calibration ${relativeTime(data.calibration[sensor.id]!, now)}`
              : 'No calibration recorded'}
          </Label>
          <Button
            variant="secondary"
            disabled={
              context.role !== 'technician' ||
              (!data.site.survey && context.connection !== 'local') ||
              !sensor.online
            }
            onPress={() =>
              perform({ type: 'calibrate', id: sensor.id }, 'Simulated calibration saved.')
            }
          >
            Record simulated calibration
          </Button>
        </Card>
      ))}
    </View>
  );
}
