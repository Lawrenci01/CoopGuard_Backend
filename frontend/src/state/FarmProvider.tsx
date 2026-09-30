import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LocalFarmRepository,
  seedLocalFarm,
  type LocalAction,
  type LocalFarmState,
} from '../services/localFarmRepository';
import type { HouseSurveyDraft } from '../domain/setup';
import type { ConnectionMode, ControlMode, Role } from '../domain/types';
import { en } from '../i18n/en';

interface FarmContextValue extends Pick<
  LocalFarmState,
  'snapshot' | 'context' | 'started' | 'notifications' | 'aiState'
> {
  data: LocalFarmState;
  now: number;
  ready: boolean;
  loadError: string | null;
  retryLoad: () => Promise<void>;
  survey: HouseSurveyDraft | null;
  toast: string | null;
  perform: (action: LocalAction, message?: string) => Promise<boolean>;
  setAIState: (value: LocalFarmState['aiState']) => void;
  setConnection: (value: ConnectionMode) => void;
  setRole: (value: Role) => void;
  setControlMode: (value: ControlMode) => void;
  acknowledge: (id: string) => Promise<void>;
  requestFullPower: () => Promise<void>;
  reconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleNotifications: () => Promise<void>;
  notify: (message: string) => void;
  enterDemo: () => Promise<void>;
  returnWelcome: () => Promise<void>;
  saveSurvey: (draft: HouseSurveyDraft) => Promise<boolean>;
}
const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: React.PropsWithChildren) {
  const [repository] = useState(() => new LocalFarmRepository(AsyncStorage));
  const [data, setData] = useState(seedLocalFarm);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  function notify(message: string) {
    if (!mounted.current) return;
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }
  async function hydrate() {
    try {
      const saved = await repository.load();
      if (mounted.current) {
        setData(saved);
        setLoadError(null);
      }
    } catch (error) {
      if (mounted.current) setLoadError(error instanceof Error ? error.message : en.cacheError);
    } finally {
      if (mounted.current) setReady(true);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void hydrate();
    return () => {
      mounted.current = false;
      clearTimeout(toastTimer.current);
    };
  }, []);
  async function perform(action: LocalAction, message?: string) {
    if (!ready || loadError) return false;
    try {
      const next = await repository.dispatch(action);
      if (mounted.current) setData(next);
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : en.toastError);
      return false;
    }
  }
  useEffect(() => {
    if (!ready || loadError) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      void perform({ type: 'tick' });
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, loadError]);
  const value: FarmContextValue = {
    ...data,
    data,
    survey: data.house,
    now,
    ready,
    loadError,
    retryLoad: hydrate,
    toast,
    notify,
    perform,
    setAIState: (value) => {
      void perform({ type: 'ai', value });
    },
    setConnection: (connection) => {
      void perform({ type: 'context', patch: { connection } });
    },
    setRole: (role) => {
      void perform({ type: 'context', patch: { role } });
    },
    setControlMode: (controlMode) => {
      void perform({ type: 'context', patch: { controlMode } });
    },
    acknowledge: async (id) => {
      await perform({ type: 'ack', id }, en.toastAck);
    },
    requestFullPower: async () => {
      await perform({ type: 'fullPower' });
    },
    reconnect: async () => {
      await perform({ type: 'reconnect' });
    },
    refresh: async () => {
      await perform({ type: 'refresh' }, en.toastRefresh);
    },
    toggleNotifications: async () => {
      await perform({ type: 'notifications', value: !data.notifications }, en.toastPreference);
    },
    enterDemo: async () => {
      await perform({ type: 'start' });
    },
    returnWelcome: async () => {
      await perform({ type: 'welcome' });
    },
    saveSurvey: (value) => perform({ type: 'house', value }, en.surveySaved),
  };
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}
export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('FarmProvider is required');
  return context;
}
