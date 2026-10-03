import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { api, ApiError, connectionModeForServer } from '../services/api';
import {
  LOCAL_FARM_KEY,
  LocalFarmRepository,
  seedLocalFarm,
  validLocalFarm,
  type LocalAction,
  type LocalFarmState,
} from '../services/localFarmRepository';
import {
  cacheKey,
  readFarmCache,
  writeFarmCache,
  visibleFarm,
  type FarmCache,
} from '../services/farmCache';
import { useAuth } from './AuthProvider';
import type { HouseSurveyDraft } from '../domain/setup';
import { en } from '../i18n/en';

interface FarmContextValue extends Pick<
  LocalFarmState,
  'snapshot' | 'context' | 'notifications' | 'aiState'
> {
  data: LocalFarmState;
  now: number;
  ready: boolean;
  loadError: string | null;
  survey: HouseSurveyDraft | null;
  surveyDraftKey: string;
  toast: string | null;
  connected: boolean;
  syncing: boolean;
  lastSyncedAt: number;
  pendingCount: number;
  revision: number;
  retryLoad: () => Promise<void>;
  refresh: () => Promise<void>;
  perform: (action: LocalAction, message?: string) => Promise<boolean>;
  acknowledge: (id: string) => Promise<void>;
  requestFullPower: () => Promise<void>;
  notify: (message: string) => void;
  saveSurvey: (draft: HouseSurveyDraft, open?: boolean) => Promise<boolean>;
  importLegacy: () => Promise<void>;
  hasLegacy: boolean;
}
const Context = createContext<FarmContextValue | null>(null);
export function FarmProvider({ children }: React.PropsWithChildren) {
  const auth = useAuth();
  if (!auth.record) throw new Error('A signed-in account is required');
  const { session, farmId } = auth.record,
    server = auth.server,
    user = session.account;
  const key = cacheKey(auth.cloudServer, user.id, farmId);
  const [cache, setCache] = useState<FarmCache | null>(null),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false),
    [syncing, setSyncing] = useState(false),
    [hasLegacy, setHasLegacy] = useState(false);
  const [now, setNow] = useState(Date.now()),
    [toast, setToast] = useState<string | null>(null);
  const current = useRef<FarmCache | null>(null),
    mounted = useRef(true),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const token = useRef(session.token);
  token.current = session.token;
  const blocked = useRef(false);
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const task = queue.current.then(fn);
    queue.current = task.catch(() => {});
    return task;
  };
  function notify(message: string) {
    if (!mounted.current) return;
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }
  async function commit(next: FarmCache) {
    await writeFarmCache(AsyncStorage, key, next);
    if (mounted.current) {
      current.current = next;
      setCache(next);
    }
  }
  const keepPreferences = (state: LocalFarmState) => ({
    ...state,
    notifications: current.current?.state.notifications ?? state.notifications,
  });
  async function sync() {
    if (!mounted.current || blocked.current) return;
    setSyncing(true);
    try {
      let result = await api.farm(server, token.current, farmId);
      if (!mounted.current) return;
      let pending = current.current?.pending ?? [];
      let pendingSurvey = current.current?.pendingSurvey;
      if (pendingSurvey) {
        result = await api.mutate(
          server,
          token.current,
          farmId,
          pendingSurvey.key,
          result.revision,
          { type: 'saveSiteSurvey', value: pendingSurvey.value },
        );
        pendingSurvey = undefined;
      }
      await commit({
        version: 1,
        ...result,
        state: keepPreferences(result.state),
        pending,
        pendingSurvey,
        syncedAt: Date.now(),
      });
      while (pending.length && mounted.current) {
        const note = pending[0]!;
        result = await api.mutate(server, token.current, farmId, note.key, result.revision, {
          type: 'saveInspection',
          kind: note.kind,
          text: note.text,
        });
        pending = pending.slice(1);
        await commit({
          version: 1,
          ...result,
          state: keepPreferences(result.state),
          pending,
          pendingSurvey,
          syncedAt: Date.now(),
        });
      }
      if (mounted.current) {
        setConnected(true);
        setLoadError(null);
      }
    } catch (error) {
      if (!mounted.current) return;
      setConnected(false);
      await auth.rejected(error);
      if (!current.current)
        setLoadError(error instanceof Error ? error.message : 'Could not load the farm.');
      else if (!(error instanceof ApiError) || error.status !== 0)
        notify(error instanceof Error ? error.message : 'Could not sync.');
    } finally {
      if (mounted.current) {
        setSyncing(false);
        setReady(true);
      }
    }
  }
  async function hydrate() {
    try {
      const saved = await readFarmCache(AsyncStorage, key);
      blocked.current = false;
      if (!mounted.current) return;
      if (saved) {
        current.current = saved;
        setCache(saved);
        setReady(true);
      }
      const legacy = await AsyncStorage.getItem(LOCAL_FARM_KEY);
      setHasLegacy(!!legacy);
      await sync();
    } catch (error) {
      blocked.current = true;
      if (mounted.current) {
        setLoadError(error instanceof Error ? error.message : 'Could not open saved data.');
        setReady(true);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void serial(hydrate);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') void serial(sync);
    }, 20_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void serial(sync);
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      clearInterval(poll);
      clearTimeout(toastTimer.current);
      subscription.remove();
    };
  }, []);
  async function perform(action: LocalAction, message?: string): Promise<boolean> {
    return serial(async () => {
      const saved = current.current;
      if (!saved || !mounted.current) return false;
      try {
        if (action.type === 'notifications') {
          await commit({ ...saved, state: { ...saved.state, notifications: action.value } });
          notify(message ?? 'Preference saved on this phone.');
          return true;
        }
        if (action.type === 'saveInspection' && !action.id) {
          const text = action.text.trim();
          if (!text || text.length > 2000)
            throw new Error('Enter an inspection note (up to 2,000 characters).');
          await commit({
            ...saved,
            pending: [
              ...saved.pending,
              { key: Crypto.randomUUID(), kind: action.kind, text, createdAt: Date.now() },
            ],
          });
          await sync();
          notify(
            current.current?.pending.length
              ? 'Saved on this phone. Waiting to sync.'
              : (message ?? 'Inspection saved.'),
          );
          return true;
        }
        const result = await api.mutate(
          server,
          token.current,
          farmId,
          Crypto.randomUUID(),
          saved.revision,
          action,
        );
        if (!mounted.current) return false;
        await commit({
          ...saved,
          ...result,
          state: keepPreferences(result.state),
          syncedAt: Date.now(),
        });
        setConnected(true);
        if (message) notify(message);
        return true;
      } catch (error) {
        if (!mounted.current) return false;
        await auth.rejected(error);
        if (error instanceof ApiError && error.status === 0) {
          if (action.type === 'saveSiteSurvey') {
            let encoded = JSON.stringify(saved.state);
            const repo = new LocalFarmRepository({
              getItem: async () => encoded,
              setItem: async (_key, value) => {
                encoded = value;
              },
            });
            await repo.load();
            await repo.dispatch({
              type: 'context',
              patch: { role: user.role, connection: 'local' },
            });
            const state = await repo.dispatch(action);
            await commit({
              ...saved,
              state,
              pendingSurvey: {
                key: Crypto.randomUUID(),
                value: action.value,
                createdAt: Date.now(),
              },
            });
            setConnected(false);
            notify('Survey saved on this phone. It will sync after reconnection.');
            return true;
          }
          setConnected(false);
          notify('Could not confirm this change. Reconnect and refresh before retrying.');
        } else {
          notify(error instanceof Error ? error.message : 'Could not save this change.');
          if (error instanceof ApiError && error.status === 409) await sync();
        }
        return false;
      }
    });
  }
  const connection = connected
    ? auth.activeConnection === 'hub'
      ? 'local'
      : 'cloud'
    : connectionModeForServer(server, false);
  const savedData = cache ? visibleFarm(cache, user, connection) : seedLocalFarm();
  const data =
    user.role === 'technician' && !savedData.site.survey
      ? { ...savedData, snapshot: { ...savedData.snapshot, sensors: [], alerts: [] } }
      : savedData;
  const value: FarmContextValue = {
    ...data,
    data,
    now,
    ready,
    loadError,
    survey: data.house,
    surveyDraftKey: `${key}:site-survey-draft`,
    toast,
    connected,
    syncing,
    lastSyncedAt: cache?.syncedAt ?? 0,
    pendingCount: cache?.pending.length ?? 0,
    revision: cache?.revision ?? 0,
    hasLegacy,
    notify,
    perform,
    retryLoad: () => serial(hydrate),
    refresh: () => serial(sync),
    acknowledge: async (id) => {
      await perform({ type: 'ack', id }, en.toastAck);
    },
    requestFullPower: async () => {
      await perform({ type: 'fullPower' });
    },
    saveSurvey: (draft, open) =>
      perform({ type: 'house', value: draft, open }, 'House details saved.'),
    importLegacy: () =>
      serial(async () => {
        const raw = await AsyncStorage.getItem(LOCAL_FARM_KEY);
        if (!raw) throw new Error('No previous phone records found.');
        let previous: unknown;
        try {
          previous = JSON.parse(raw);
        } catch {
          throw new Error('The previous records could not be read.');
        }
        if (!validLocalFarm(previous))
          throw new Error('The previous records are invalid. They have been kept on this phone.');
        const result = await api.import(server, token.current, farmId, previous);
        await commit({
          version: 1,
          ...result,
          pending: current.current?.pending ?? [],
          syncedAt: Date.now(),
        });
        setConnected(true);
        notify('Previous phone records copied into this farm.');
      }),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFarm() {
  const value = useContext(Context);
  if (!value) throw new Error('FarmProvider is required');
  return value;
}
