import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../state/AuthProvider';
import { api, apiRequest } from '../services/api';
import type { WorkerAccount } from '../services/apiTypes';
import { AuthField } from '../screens/LoginScreen';
import { Button, Card, Label } from './ui';
import { colors } from '../theme';

export function WorkerAccounts() {
  const auth = useAuth(),
    r = auth.record!;
  const [workers, setWorkers] = useState<WorkerAccount[]>([]),
    [name, setName] = useState(''),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [editing, setEditing] = useState<WorkerAccount | null>(null),
    [reset, setReset] = useState<WorkerAccount | null>(null),
    [disabling, setDisabling] = useState<WorkerAccount | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState('');
  const base = `/v1/farms/${encodeURIComponent(r.farmId)}/workers`;
  async function load() {
    try {
      setWorkers(await api.workers(r.server, r.session.token, r.farmId));
      setLoaded(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workers.');
      await auth.rejected(e);
    }
  }
  useEffect(() => {
    void load();
  }, [r.farmId]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the account.');
      await auth.rejected(e);
    } finally {
      setBusy(false);
    }
  }
  if (r.session.account.role !== 'owner')
    return <Label>Worker accounts are managed by the farm owner.</Label>;
  return (
    <View style={{ gap: 16 }}>
      <Label>
        Create workers for this farm. Give each worker a separate username and temporary password.
      </Label>
      {!!error && (
        <Label accessibilityLiveRegion="polite" style={{ color: colors.red }}>
          {error}
        </Label>
      )}
      {!!message && (
        <Label accessibilityLiveRegion="polite" style={{ color: colors.green }}>
          {message}
        </Label>
      )}
      {!loaded && (
        <Button variant="secondary" disabled={busy} onPress={() => void load()}>
          Load workers
        </Button>
      )}
      {workers.map((worker) => (
        <Card key={worker.id} style={{ gap: 10 }}>
          <Label weight="bold">{worker.name}</Label>
          <Label>
            {worker.username} · {worker.active ? 'Active' : 'Disabled'}
          </Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              compact
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setEditing(worker);
                setReset(null);
                setName(worker.name);
                setUsername(worker.username);
                setPassword('');
              }}
            >
              Edit
            </Button>
            <Button
              compact
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setReset(worker);
                setEditing(null);
                setPassword('');
              }}
            >
              Reset password
            </Button>
            <Button compact variant="ghost" disabled={busy} onPress={() => setDisabling(worker)}>
              {worker.active ? 'Disable' : 'Enable'}
            </Button>
          </View>
          {disabling?.id === worker.id && (
            <>
              <Label>
                {worker.active
                  ? 'Disable this worker and revoke their sessions?'
                  : 'Enable this worker again?'}
              </Label>
              <Button
                variant={worker.active ? 'danger' : 'secondary'}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    setWorkers(
                      await apiRequest<WorkerAccount[]>(
                        r.server,
                        `${base}/${worker.id}`,
                        r.session.token,
                        { name: worker.name, active: !worker.active },
                        'PATCH',
                      ),
                    );
                    setDisabling(null);
                  })
                }
              >
                Confirm {worker.active ? 'disable' : 'enable'}
              </Button>
              <Button variant="ghost" onPress={() => setDisabling(null)}>
                Cancel
              </Button>
            </>
          )}
        </Card>
      ))}
      <Card style={{ gap: 16 }}>
        <Label weight="bold">
          {reset ? `Reset ${reset.username}'s password` : editing ? 'Edit worker' : 'Add worker'}
        </Label>
        {!reset && (
          <>
            <AuthField label="Worker name" value={name} onChange={setName} />
            {!editing && (
              <AuthField label="Worker username" value={username} onChange={setUsername} />
            )}
          </>
        )}
        {!editing && (
          <>
            <AuthField label="Temporary password" value={password} onChange={setPassword} secret />
            <Label style={{ fontSize: 12, color: colors.muted }}>
              At least 12 characters. The worker must change it at first sign-in.
            </Label>
          </>
        )}
        <Button
          testID="save-worker-account"
          disabled={
            busy ||
            (!reset && !name.trim()) ||
            (!editing && password.length < 12) ||
            (!editing && !reset && !username.trim())
          }
          onPress={() =>
            void run(async () => {
              if (reset) {
                await apiRequest(r.server, `${base}/${reset.id}/password`, r.session.token, {
                  temporaryPassword: password,
                });
                setMessage('Temporary password saved. Give it to the worker privately.');
              } else if (editing) {
                setWorkers(
                  await apiRequest<WorkerAccount[]>(
                    r.server,
                    `${base}/${editing.id}`,
                    r.session.token,
                    { name, active: editing.active },
                    'PATCH',
                  ),
                );
                setMessage('Worker updated.');
              } else {
                setWorkers(
                  await apiRequest<WorkerAccount[]>(r.server, base, r.session.token, {
                    username,
                    name,
                    temporaryPassword: password,
                  }),
                );
                setMessage(
                  'Worker created. Give them their username and temporary password privately.',
                );
              }
              setName('');
              setUsername('');
              setPassword('');
              setEditing(null);
              setReset(null);
            })
          }
        >
          {busy
            ? 'Saving…'
            : reset
              ? 'Save temporary password'
              : editing
                ? 'Save worker'
                : 'Create worker account'}
        </Button>
        {(editing || reset) && (
          <Button
            variant="ghost"
            onPress={() => {
              setEditing(null);
              setReset(null);
              setName('');
              setUsername('');
              setPassword('');
            }}
          >
            Cancel
          </Button>
        )}
      </Card>
    </View>
  );
}
