import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import App from '../App';
import { en } from '../src/i18n/en';
import {
  LocalFarmRepository,
  seedLocalFarm,
  LOCAL_FARM_KEY,
} from '../src/services/localFarmRepository';
import { api, apiRequest, ApiError } from '../src/services/api';
import type { Session, WorkerAccount } from '../src/services/apiTypes';
import type { Role } from '../src/domain/types';
import { workflowFromSurvey } from '../src/domain/siteWorkflow';
import { commissionSiteForControl, completeSiteSurvey } from './siteTestFixture';

jest.mock('../src/services/api', () => {
  const actual = jest.requireActual<typeof import('../src/services/api')>('../src/services/api');
  return {
    ...actual,
    apiRequest: jest.fn(),
    api: Object.fromEntries(Object.keys(actual.api).map((key) => [key, jest.fn()])),
  };
});
let farm = seedLocalFarm(),
  revision = 0,
  offline = false,
  workers: WorkerAccount[] = [];
const sessions = new Map<string, Session>();
const keys = new Set<string>();
const sessionFor = (role: Role, forced = false): Session => ({
  token: role[0]!.repeat(43),
  expiresAt: Date.now() + 7 * 86_400_000,
  account: { id: role, username: role, name: `${role} name`, role, mustChangePassword: forced },
  farms: role === 'admin' ? [] : [{ id: 'farm-1', name: 'Pilot farm', code: 'CG-PH-TEST01' }],
});
function online() {
  if (offline) throw new ApiError(0, 'Cannot reach the farm server.');
}
async function signIn(username = 'owner') {
  await fireEvent.changeText(await screen.findByLabelText('Username'), username);
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Test password 123!');
  await fireEvent.press(screen.getByTestId('sign-in'));
}
async function openTechnicianFarm() {
  await screen.findByText('Select the farm for this visit');
  await fireEvent.changeText(screen.getByLabelText('Farm ID'), 'CG-PH-TEST01');
  await fireEvent.press(screen.getByTestId('open-technician-farm'));
  await screen.findByTestId('screen-Dashboard');
}
async function prepareActivatedFarm() {
  let stored = JSON.stringify(farm);
  const repo = new LocalFarmRepository({
    getItem: async () => stored,
    setItem: async (_key, value) => {
      stored = value;
    },
  });
  await repo.load();
  await commissionSiteForControl(repo);
  farm = JSON.parse(stored);
  farm.flock = null;
}
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await SecureStore.deleteItemAsync('coopguard.auth.v1');
  farm = seedLocalFarm();
  farm.started = true;
  farm.flock = null;
  revision = 0;
  offline = false;
  workers = [];
  sessions.clear();
  keys.clear();
  jest.mocked(api.login).mockImplementation(async (_s, username) => {
    online();
    if (username === 'wrong') throw new ApiError(401, 'Incorrect username or password.');
    const role: Role =
      username === 'new.worker'
        ? 'worker'
        : username === 'team.admin'
          ? 'admin'
          : (username as Role);
    const session = sessionFor(role, username === 'new.worker');
    sessions.set(session.token, session);
    return session;
  });
  jest.mocked(api.health).mockResolvedValue({
    service: 'CoopGuard',
    version: '0.5.0',
    readings: 'sample',
    mode: 'hub',
    hubId: 'pilot-hub',
  });
  jest.mocked(api.me).mockImplementation(async (_s, token) => {
    online();
    const s = sessions.get(token);
    if (!s) throw new ApiError(401, 'Session ended.');
    return s;
  });
  jest.mocked(api.password).mockImplementation(async (_s, token) => {
    online();
    const old = sessions.get(token)!;
    const next = {
      ...old,
      token: 'n'.repeat(43),
      account: { ...old.account, mustChangePassword: false },
    };
    sessions.delete(token);
    sessions.set(next.token, next);
    return next;
  });
  jest.mocked(api.logout).mockImplementation(async (_s, token) => {
    online();
    sessions.delete(token);
    return { ok: true };
  });
  jest.mocked(api.farm).mockImplementation(async () => {
    online();
    return { state: JSON.parse(JSON.stringify(farm)), revision };
  });
  jest.mocked(api.mutate).mockImplementation(async (_s, token, _f, key, _revision, action) => {
    online();
    if (keys.has(key)) return { state: JSON.parse(JSON.stringify(farm)), revision };
    const user = sessions.get(token)!.account;
    let stored = JSON.stringify(farm);
    const repo = new LocalFarmRepository({
      getItem: async () => stored,
      setItem: async (_k, v) => {
        stored = v;
      },
    });
    await repo.load();
    await repo.dispatch({ type: 'context', patch: { role: user.role, connection: 'local' } });
    farm = await repo.dispatch(action);
    if (action.type === 'saveInspection' && !action.id)
      Object.assign(farm.inspections[0]!, { authorId: user.id, authorName: user.name });
    revision++;
    keys.add(key);
    return { state: JSON.parse(JSON.stringify(farm)), revision };
  });
  jest.mocked(api.workers).mockImplementation(async () => {
    online();
    return workers;
  });
  jest.mocked(api.adminCreateFarm).mockResolvedValue({
    farmId: 'admin-farm-record',
    farmCode: 'CG-PH-ABCD1234',
    qr: 'coopguard://farm/open?version=1&farm=CG-PH-ABCD1234',
    owner: { username: 'north.owner', name: 'North Owner', password: 'Temp-owner-pass-123' },
    technician: {
      username: 'north.tech',
      name: 'North Technician',
      created: true,
      password: 'Temp-technician-pass-123',
    },
  });
  jest.mocked(apiRequest).mockImplementation(async (_s, _p, _token, body) => {
    online();
    const b = body as { username: string; name: string };
    workers = [
      ...workers,
      {
        id: 'worker-created',
        username: b.username,
        name: b.name,
        active: true,
        mustChangePassword: true,
      },
    ];
    return workers as never;
  });
});

describe('authenticated native mobile flows', () => {
  test('admin signs in without a farm and provisions a farm with credentials and QR', async () => {
    jest.mocked(api.adminCreateFarm).mockReset();
    jest.mocked(api.adminCreateFarm).mockResolvedValueOnce({
      farmId: 'admin-farm-record',
      farmCode: 'CG-PH-ABCD1234',
      qr: 'coopguard://farm/open?version=1&farm=CG-PH-ABCD1234',
      owner: { username: 'north.owner', name: 'North Owner', password: 'Temp-owner-pass-123' },
      technician: {
        username: 'north.tech',
        name: 'North Technician',
        created: true,
        password: 'Temp-technician-pass-123',
      },
    });
    jest.mocked(api.adminCreateFarm).mockResolvedValueOnce({
      farmId: 'south-farm-record',
      farmCode: 'CG-PH-SOUTH123',
      qr: 'coopguard://farm/open?version=1&farm=CG-PH-SOUTH123',
      owner: { username: 'south.owner', name: 'South Owner', password: 'Temp-owner-pass-456' },
      technician: {
        username: 'north.tech',
        name: 'North Technician',
        created: false,
      },
    });
    await render(<App />);
    await signIn('team.admin');
    await screen.findByTestId('admin-workspace');
    expect(screen.getByText('Register a farm')).toBeTruthy();
    expect(screen.queryByTestId('nav-Dashboard')).toBeNull();

    const fields = {
      'Farm name': 'North Valley Poultry',
      'Customer name': 'North Valley Coop',
      'Contact person': 'Casey Green',
      'Contact number': '+1 555 010 2020',
      'Farm address': '12 River Lane, Bayview',
      'Owner full name': 'North Owner',
      'Owner username': 'north.owner',
      'Technician full name': 'North Technician',
      'Technician username': 'north.tech',
    };
    for (const [label, value] of Object.entries(fields))
      await fireEvent.changeText(screen.getByLabelText(label), value);
    await fireEvent.press(screen.getByTestId('admin-create-farm'));

    await screen.findByTestId('admin-farm-created');
    expect(screen.getByText('CG-PH-ABCD1234')).toBeTruthy();
    expect(screen.getByText(/Temp-owner-pass-123/)).toBeTruthy();
    expect(screen.getByText(/Temp-technician-pass-123/)).toBeTruthy();
    expect(api.adminCreateFarm).toHaveBeenCalledWith(expect.any(String), 'a'.repeat(43), {
      farmName: 'North Valley Poultry',
      customerName: 'North Valley Coop',
      contactName: 'Casey Green',
      contactPhone: '+1 555 010 2020',
      address: '12 River Lane, Bayview',
      ownerName: 'North Owner',
      ownerUsername: 'north.owner',
      technicianName: 'North Technician',
      technicianUsername: 'north.tech',
    });

    await fireEvent.press(screen.getByText('Create another farm'));
    expect(screen.getByLabelText('Technician username').props.value).toBe('north.tech');
    expect(screen.getByLabelText('Technician full name').props.value).toBe('North Technician');
    for (const [label, value] of Object.entries({
      'Farm name': 'South Valley Poultry',
      'Customer name': 'South Valley Coop',
      'Contact person': 'Jordan Green',
      'Contact number': '+1 555 010 2021',
      'Farm address': '44 Lake Road, Bayview',
      'Owner full name': 'South Owner',
      'Owner username': 'south.owner',
    }))
      await fireEvent.changeText(screen.getByLabelText(label), value);
    await fireEvent.press(screen.getByTestId('admin-create-farm'));
    await screen.findByText('Existing technician reused. No new password was created.');
    expect(screen.queryByText(/Temp-technician-pass-123/)).toBeNull();
    expect(api.adminCreateFarm).toHaveBeenCalledTimes(2);
  });

  test('failed login stays private; first sign-in requires a new password', async () => {
    await prepareActivatedFarm();
    await render(<App />);
    await signIn('wrong');
    await screen.findByText('Incorrect username or password.');
    expect(screen.queryByTestId('screen-Dashboard')).toBeNull();
    await signIn('new.worker');
    await screen.findByText('Set your password');
    expect(screen.queryByTestId('nav-Dashboard')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'Test password 123!');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'My new password 456!');
    await fireEvent.changeText(
      screen.getByLabelText('Confirm new password'),
      'My new password 456!',
    );
    await fireEvent.press(screen.getByTestId('change-password'));
    await screen.findByText('Daily checks');
    expect(screen.getByTestId('nav-Notes')).toBeTruthy();
    expect(screen.queryByTestId('nav-Devices')).toBeNull();
    expect(screen.queryByTestId('nav-Analytics')).toBeNull();
    const secure = JSON.parse((await SecureStore.getItemAsync('coopguard.auth.v1'))!);
    expect(secure.session.account.role).toBe('worker');
    expect(JSON.stringify(secure)).not.toContain('password 456');
  });
  test('owner sees only setup progress until survey, device pairing and activation are complete', async () => {
    await render(<App />);
    await signIn();
    await screen.findByText('SETUP IN PROGRESS');
    expect(screen.queryByTestId('nav-Dashboard')).toBeNull();
    expect(screen.queryByTestId('house-attention')).toBeNull();
    expect(screen.getByText('Farm ID CG-PH-TEST01')).toBeTruthy();
  });
  test('activated owner sees farm functions and can create worker accounts', async () => {
    await prepareActivatedFarm();
    await render(<App />);
    await signIn();
    await screen.findByText('Farm overview');
    await fireEvent.press(screen.getByTestId('nav-Heat-Map'));
    expect(screen.getAllByTestId(/^map-NODE-/)).toHaveLength(3);
    expect(screen.queryByTestId('map-sensor-01')).toBeNull();
    await fireEvent.press(screen.getByTestId('nav-Dashboard'));
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await fireEvent.press(await screen.findByTestId('settings-people'));
    await fireEvent.changeText(await screen.findByLabelText('Worker name'), 'Juan');
    await fireEvent.changeText(screen.getByLabelText('Worker username'), 'juan.worker');
    await fireEvent.changeText(
      screen.getByLabelText('Temporary password'),
      'A temporary password!',
    );
    await fireEvent.press(screen.getByTestId('save-worker-account'));
    await screen.findByText('Juan');
    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(String),
      '/v1/farms/farm-1/workers',
      expect.any(String),
      { username: 'juan.worker', name: 'Juan', temporaryPassword: 'A temporary password!' },
    );
    expect(screen.queryByTestId('role-technician')).toBeNull();
    expect(screen.getByLabelText('Temporary password').props.value).toBe('');
  });
  test('technician selects a farm then sees its operational tabs without unrelated demo nodes', async () => {
    await render(<App />);
    await signIn('technician');
    await screen.findByText('Select the farm for this visit');
    expect(screen.queryByText('Section B is getting warm')).toBeNull();
    expect(screen.queryByText('House readings')).toBeNull();
    expect(screen.queryByTestId('nav-Alerts')).toBeNull();
    await openTechnicianFarm();
    expect(screen.getByTestId('nav-Dashboard')).toBeTruthy();
    expect(screen.getByTestId('nav-Alerts')).toBeTruthy();
    expect(screen.getByTestId('nav-Heat-Map')).toBeTruthy();
    expect(screen.getByTestId('nav-Analytics')).toBeTruthy();
    expect(screen.getByTestId('nav-Devices')).toBeTruthy();
    expect(screen.queryByText('Section B is getting warm')).toBeNull();
    expect(screen.getByText('House readings')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-Heat-Map'));
    expect(screen.queryByTestId('map-sensor-01')).toBeNull();
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await fireEvent.press(screen.getByTestId('site-survey'));
    expect(screen.getByText('Start site survey')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('account-menu'));
    await fireEvent.press(screen.getByTestId('sign-out'));
    await screen.findByLabelText('Username');
    expect(screen.queryByTestId('nav-Devices')).toBeNull();
    expect(await SecureStore.getItemAsync('coopguard.auth.v1')).toBeNull();
  });
  test('technician pairs a hub once and the app prefers it for farm access', async () => {
    await render(<App />);
    await signIn('technician');
    await openTechnicianFarm();
    await fireEvent.press(screen.getByTestId('account-menu'));
    await fireEvent.press(screen.getByTestId('hub-setup'));
    await fireEvent.changeText(
      screen.getByLabelText('Farm hub HTTPS address'),
      'https://192.168.4.1:8443',
    );
    await fireEvent.press(screen.getByTestId('save-hub-pairing'));
    await waitFor(() =>
      expect(api.me).toHaveBeenCalledWith('https://192.168.4.1:8443', expect.any(String)),
    );
    await waitFor(() =>
      expect(String(screen.getByTestId('connection-status').props.children)).toContain('Farm hub'),
    );
  });
  test('technician approves a generated plan before the installation checklist opens', async () => {
    const survey = completeSiteSurvey();
    farm.site = workflowFromSurvey(survey);
    farm.house = {
      farmName: survey.farm.farmName,
      houseName: survey.farm.houseName,
      houseType: 'open',
      controller: 'absent',
      flock: 'broiler',
      lengthMetres: survey.house.lengthMetres,
      widthMetres: survey.house.widthMetres,
    };
    await render(<App />);
    await signIn('technician');
    await openTechnicianFarm();
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await fireEvent.press(screen.getByText('Site survey'));
    expect(await screen.findByText('Full-control candidate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('approve-plan'));
    await fireEvent.press(await screen.findByTestId('start-installation'));
    expect(await screen.findByText('Installation checklist')).toBeTruthy();
    expect(screen.getByText('Hub mounted at the approved location')).toBeTruthy();
  });
  test('technician can update simulated device firmware from the selected farm', async () => {
    await prepareActivatedFarm();
    await render(<App />);
    await signIn('technician');
    await openTechnicianFarm();
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await fireEvent.press(screen.getByTestId('site-survey'));
    await fireEvent.press(screen.getByTestId('settings-software'));
    await screen.findByText('Simulated device firmware');
    await fireEvent.press(screen.getAllByText('Simulate firmware update')[1]!);
    await screen.findByText(/firmware\s+0\.1\.1-sim/);
    expect(screen.getByText(/Simulated firmware updated to 0\.1\.1-sim/)).toBeTruthy();
    expect(api.mutate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'farm-1',
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ type: 'updateVirtualFirmware' }),
    );
  });
  test('technician survey does not expose demo readings before nodes report', async () => {
    const app = await render(<App />);
    await signIn('technician');
    await openTechnicianFarm();
    await fireEvent.press(screen.getByText('Start site survey'));
    await fireEvent.press(screen.getByText('Open-sided'));
    await fireEvent.press(screen.getAllByText('90 m')[0]!);
    await fireEvent.press(screen.getAllByText('12 m')[1]!);
    await fireEvent.press(screen.getByText('Save & continue'));
    await fireEvent.press(screen.getByText('Absent'));
    await fireEvent.press(screen.getByText('Save & continue'));
    await fireEvent.press(screen.getByText('Protected service room'));
    await fireEvent.press(screen.getByText('Service room'));
    await fireEvent.press(screen.getByText('Save & continue'));
    await fireEvent.press(screen.getByText('Save & continue'));
    await fireEvent.press(screen.getByText('Start generator and inspect'));
    await fireEvent.press(
      screen.getByLabelText('Owner reviewed the recorded installation findings'),
    );
    await fireEvent.press(screen.getByLabelText('Technician confirms the survey is accurate'));
    await fireEvent.press(screen.getByText('Complete survey'));
    await waitFor(() => expect(farm.site.survey?.farm.houseName).toBe('Main house'));
    expect(screen.getByTestId('house-attention')).toBeTruthy();
    expect(screen.getByText('House readings')).toBeTruthy();
    expect(screen.queryByText('Section B is getting warm')).toBeNull();
    expect(farm.context.controlMode).toBe('monitor');
    await app.unmount();
    await render(<App />);
    await screen.findByText('Select the farm for this visit');
    expect(screen.queryByTestId('open-flock')).toBeNull();
    expect(screen.queryByTestId('house-attention')).toBeNull();
    expect(await AsyncStorage.getItem(LOCAL_FARM_KEY)).toBeNull();
  });
  test('cached account opens offline, queues notes, blocks commands and syncs after reconnection', async () => {
    await prepareActivatedFarm();
    const app = await render(<App />);
    await signIn('worker');
    await screen.findByTestId('screen-Dashboard');
    await app.unmount();
    offline = true;
    await render(<App />);
    await screen.findByText('Daily checks');
    await waitFor(() =>
      expect(screen.getByTestId('connection-status').props.children).toContain(
        'Server unavailable · saved data',
      ),
    );
    await fireEvent.press(screen.getByTestId('open-equipment'));
    expect(screen.getByTestId('full-power').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(en.offlineAction)).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText(en.close).at(-1)!);
    await fireEvent.press(screen.getByTestId('nav-Notes'));
    await fireEvent.changeText(
      await screen.findByLabelText('What did you notice?'),
      'Birds settled after feeding.',
    );
    await fireEvent.press(screen.getByTestId('save-inspection'));
    await screen.findByText('Saved on this phone · waiting to sync');
    expect(farm.inspections).toHaveLength(0);
    offline = false;
    await fireEvent.press(screen.getByTestId('account-menu'));
    await fireEvent.press(screen.getByText('Sync now'));
    await waitFor(() => expect(farm.inspections).toHaveLength(1));
    await fireEvent.press(screen.getAllByLabelText(en.close).at(-1)!);
    await waitFor(() =>
      expect(screen.queryByText('Saved on this phone · waiting to sync')).toBeNull(),
    );
    expect(farm.inspections[0]!.authorId).toBe('worker');
  });
});
