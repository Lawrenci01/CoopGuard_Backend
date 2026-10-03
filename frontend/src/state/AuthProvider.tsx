import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, normalizeServer } from '../services/api';
import type { Session } from '../services/apiTypes';

const SESSION_KEY = 'coopguard.auth.v1';
const HUBS_KEY = 'coopguard.hubs.v1';
export const CLOUD_SERVER = normalizeServer(
  process.env.EXPO_PUBLIC_API_URL ?? 'https://coopguard-backend.onrender.com',
);
export const OFFLINE_GRACE_MS = 24 * 60 * 60_000;

export interface SavedSession {
  server: string;
  session: Session;
  farmId: string;
  verifiedAt: number;
}
interface HubProfile {
  server: string;
  hubId: string;
  pairedAt: number;
}
type HubProfiles = Record<string, HubProfile>;
type ActiveConnection = 'hub' | 'cloud' | 'offline';
interface AuthContextValue {
  ready: boolean;
  record: SavedSession | null;
  server: string;
  cloudServer: string;
  hubServer: string | null;
  activeConnection: ActiveConnection;
  online: boolean;
  cloudOnline: boolean;
  hubOnline: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  pairHub: (value: string) => Promise<void>;
  forgetHub: () => Promise<void>;
  selectFarm: (id: string) => Promise<void>;
  revalidate: () => Promise<void>;
  rejected: (error: unknown) => Promise<void>;
}
const Context = createContext<AuthContextValue | null>(null);

export function validSession(value: unknown): value is SavedSession {
  try {
    const r = value as SavedSession;
    const s = r.session;
    const admin = s.account.role === 'admin';
    s.farms?.forEach((farm) => {
      if (typeof farm.code !== 'string')
        farm.code = `CG-PH-${farm.id
          .replace(/[^a-z0-9]/gi, '')
          .slice(0, 8)
          .toUpperCase()}`;
    });
    return (
      normalizeServer(r.server) === r.server &&
      /^[A-Za-z0-9_-]{43}$/.test(s.token) &&
      Number.isFinite(s.expiresAt) &&
      Number.isFinite(r.verifiedAt) &&
      typeof s.account.id === 'string' &&
      typeof s.account.username === 'string' &&
      typeof s.account.name === 'string' &&
      ['owner', 'worker', 'technician', 'admin'].includes(s.account.role) &&
      typeof s.account.mustChangePassword === 'boolean' &&
      Array.isArray(s.farms) &&
      (admin
        ? s.farms.length === 0 && r.farmId === ''
        : s.farms.length > 0 && s.farms.some((farm) => farm.id === r.farmId)) &&
      s.farms.every(
        (farm) =>
          typeof farm.id === 'string' &&
          typeof farm.name === 'string' &&
          /^CG-[A-Z0-9-]{4,32}$/.test(farm.code),
      )
    );
  } catch {
    return false;
  }
}

function validHubProfiles(value: unknown): value is HubProfiles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([farmId, profile]) => {
    try {
      const item = profile as HubProfile;
      return (
        !!farmId &&
        normalizeServer(item.server) === item.server &&
        typeof item.hubId === 'string' &&
        item.hubId.length > 0 &&
        Number.isFinite(item.pairedAt)
      );
    } catch {
      return false;
    }
  });
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [record, setRecord] = useState<SavedSession | null>(null);
  const [server, setServer] = useState(CLOUD_SERVER);
  const [online, setOnline] = useState(false);
  const [cloudOnline, setCloudOnline] = useState(false);
  const [hubOnline, setHubOnline] = useState(false);
  const [activeConnection, setActiveConnection] = useState<ActiveConnection>('offline');
  const [error, setError] = useState<string | null>(null);
  const current = useRef<SavedSession | null>(null);
  const hubs = useRef<HubProfiles>({});
  const epoch = useRef(0);
  const mounted = useRef(true);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback((work: () => Promise<void>) => {
    const task = writes.current.then(work);
    writes.current = task.catch(() => {});
    return task;
  }, []);
  const store = useCallback(
    async (next: SavedSession) => {
      if (!validSession(next)) throw new Error('The server returned an invalid account response.');
      const generation = epoch.current;
      await persist(async () => {
        if (generation !== epoch.current || !mounted.current) return;
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (generation === epoch.current && mounted.current) {
          current.current = next;
          setRecord(next);
        }
      });
    },
    [persist],
  );
  const clear = useCallback(
    async (message?: string) => {
      epoch.current++;
      current.current = null;
      setRecord(null);
      setServer(CLOUD_SERVER);
      setOnline(false);
      setCloudOnline(false);
      setHubOnline(false);
      setActiveConnection('offline');
      setError(message ?? null);
      try {
        await persist(() => SecureStore.deleteItemAsync(SESSION_KEY));
      } catch {
        if (mounted.current)
          setError('Could not remove the saved session. Reconnect and sign out again.');
      }
    },
    [persist],
  );
  const validate = useCallback(
    async (saved: SavedSession) => {
      const generation = epoch.current;
      if (saved.session.expiresAt <= Date.now()) {
        await clear('Your session expired. Sign in again.');
        return;
      }
      const hub =
        hubs.current[saved.farmId]?.server ??
        (saved.session.account.role === 'admin' && saved.server !== CLOUD_SERVER
          ? saved.server
          : undefined);
      const [cloudResult, hubResult] = await Promise.allSettled([
        api.me(CLOUD_SERVER, saved.session.token),
        hub ? api.me(hub, saved.session.token) : Promise.reject(new ApiError(0, 'Hub not paired.')),
      ]);
      if (generation !== epoch.current || !mounted.current) return;
      const cloudOk = cloudResult.status === 'fulfilled';
      const hubOk = !!hub && hubResult.status === 'fulfilled';
      setCloudOnline(cloudOk);
      setHubOnline(hubOk);
      const cloudFailure = cloudResult.status === 'rejected' ? cloudResult.reason : null;
      if (cloudFailure instanceof ApiError && cloudFailure.status === 401) {
        await clear(cloudFailure.message);
        return;
      }
      if (hubOk || cloudOk) {
        const identity =
          hubOk && hubResult.status === 'fulfilled'
            ? hubResult.value
            : cloudResult.status === 'fulfilled'
              ? cloudResult.value
              : null;
        if (!identity || (identity.account.role !== 'admin' && !identity.farms.length)) {
          await clear('No farm is assigned to this account. Contact the CoopGuard team.');
          return;
        }
        const activeServer = hubOk ? hub! : CLOUD_SERVER;
        setServer(activeServer);
        setActiveConnection(hubOk ? 'hub' : 'cloud');
        setOnline(true);
        setError(null);
        await store({
          ...saved,
          server: activeServer,
          session: { ...saved.session, ...identity },
          farmId:
            identity.account.role === 'admin'
              ? ''
              : identity.farms.some((farm) => farm.id === saved.farmId)
                ? saved.farmId
                : identity.farms[0]!.id,
          verifiedAt: Date.now(),
        });
        return;
      }
      const issuerFailure =
        saved.server === hub && hubResult.status === 'rejected' ? hubResult.reason : cloudFailure;
      if (issuerFailure instanceof ApiError && issuerFailure.status === 401) {
        await clear(issuerFailure.message);
      } else if (
        Date.now() - saved.verifiedAt < OFFLINE_GRACE_MS &&
        !saved.session.account.mustChangePassword
      ) {
        current.current = saved;
        setRecord(saved);
        setOnline(false);
        setActiveConnection('offline');
      } else {
        await clear(
          issuerFailure instanceof Error ? issuerFailure.message : 'Please sign in again.',
        );
      }
    },
    [clear, store],
  );

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const rawHubs = await AsyncStorage.getItem(HUBS_KEY);
        if (rawHubs) {
          const parsed: unknown = JSON.parse(rawHubs);
          if (validHubProfiles(parsed)) hubs.current = parsed;
        }
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (validSession(saved)) await validate(saved);
          else await clear('Please sign in again.');
        }
      } catch {
        if (mounted.current) setError('Could not restore your session. Please sign in.');
      } finally {
        if (mounted.current) setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
      epoch.current++;
    };
  }, [clear, validate]);
  useEffect(() => {
    const check = () => {
      if (current.current) void validate(current.current);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const timer = setInterval(check, 45_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [validate]);

  const hubServer = record ? (hubs.current[record.farmId]?.server ?? null) : null;
  const value: AuthContextValue = {
    ready,
    record,
    server,
    cloudServer: CLOUD_SERVER,
    hubServer,
    activeConnection,
    online,
    cloudOnline,
    hubOnline,
    error,
    login: async (username, password) => {
      const generation = ++epoch.current;
      setError(null);
      let loginServer = CLOUD_SERVER;
      let session: Session;
      try {
        session = await api.login(CLOUD_SERVER, username.trim(), password);
        setCloudOnline(true);
      } catch (cloudError) {
        const canFallback =
          cloudError instanceof ApiError && (cloudError.status === 0 || cloudError.status >= 500);
        const pairedHub = Object.values(hubs.current)[0]?.server;
        if (!canFallback || !pairedHub) throw cloudError;
        loginServer = pairedHub;
        session = await api.login(pairedHub, username.trim(), password);
        setCloudOnline(false);
        setHubOnline(true);
      }
      if (session.account.role !== 'admin' && !session.farms.length)
        throw new Error('No farm is assigned. Contact the CoopGuard team.');
      if (generation !== epoch.current) return;
      const next = {
        server: loginServer,
        session,
        farmId: session.account.role === 'admin' ? '' : session.farms[0]!.id,
        verifiedAt: Date.now(),
      };
      await store(next);
      setServer(loginServer);
      setActiveConnection(loginServer === CLOUD_SERVER ? 'cloud' : 'hub');
      setOnline(true);
      void validate(next);
    },
    logout: async () => {
      const saved = current.current;
      const endpoints = new Set([
        CLOUD_SERVER,
        saved ? hubs.current[saved.farmId]?.server : undefined,
        saved?.session.account.role === 'admin' && saved.server !== CLOUD_SERVER
          ? saved.server
          : undefined,
      ]);
      await clear();
      if (saved)
        await Promise.allSettled(
          [...endpoints]
            .filter((endpoint): endpoint is string => !!endpoint)
            .map((endpoint) => api.logout(endpoint, saved.session.token)),
        );
    },
    changePassword: async (currentPassword, newPassword) => {
      const saved = current.current;
      if (!saved) throw new Error('Sign in first.');
      const generation = ++epoch.current;
      const session = await api.password(
        CLOUD_SERVER,
        saved.session.token,
        currentPassword,
        newPassword,
      );
      if (generation !== epoch.current) return;
      const next = { ...saved, server: CLOUD_SERVER, session, verifiedAt: Date.now() };
      await store(next);
      setServer(CLOUD_SERVER);
      setCloudOnline(true);
      setHubOnline(false);
      setActiveConnection('cloud');
      setOnline(true);
    },
    pairHub: async (value) => {
      const saved = current.current;
      if (!saved || saved.session.account.role !== 'technician')
        throw new Error('Only a CoopGuard technician can pair a farm hub.');
      const candidate = normalizeServer(value);
      const health = await api.health(candidate);
      if (health.service !== 'CoopGuard' || health.mode !== 'hub' || !health.hubId)
        throw new Error('This address is not a commissioned CoopGuard farm hub.');
      const next = {
        ...hubs.current,
        [saved.farmId]: { server: candidate, hubId: health.hubId, pairedAt: Date.now() },
      };
      await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(next));
      hubs.current = next;
      await validate(saved);
    },
    forgetHub: async () => {
      const saved = current.current;
      if (!saved || saved.session.account.role !== 'technician')
        throw new Error('Only a CoopGuard technician can remove a farm hub pairing.');
      const next = { ...hubs.current };
      delete next[saved.farmId];
      await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(next));
      hubs.current = next;
      setHubOnline(false);
      setServer(CLOUD_SERVER);
      setActiveConnection(cloudOnline ? 'cloud' : 'offline');
      setOnline(cloudOnline);
    },
    selectFarm: async (id) => {
      const saved = current.current;
      if (!saved || !saved.session.farms.some((farm) => farm.id === id)) return;
      epoch.current++;
      const next = { ...saved, farmId: id };
      await store(next);
      await validate(next);
    },
    revalidate: async () => {
      if (current.current) await validate(current.current);
    },
    rejected: async (requestError) => {
      if (record?.session.token !== current.current?.session.token) return;
      if (requestError instanceof ApiError && requestError.status === 401 && current.current)
        await validate(current.current);
      else if (requestError instanceof ApiError && requestError.status === 0) {
        setOnline(false);
        setActiveConnection('offline');
        if (server === CLOUD_SERVER) setCloudOnline(false);
        else setHubOnline(false);
      }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}
