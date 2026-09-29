import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoFarmService } from '../services/demoFarmService';
import type {
  ConnectionMode,
  ControlMode,
  FarmSnapshot,
  PreviewContext,
  Role,
} from '../domain/types';
import { en } from '../i18n/en';

interface FarmContextValue {
  snapshot: FarmSnapshot;
  context: PreviewContext;
  now: number;
  notifications: boolean;
  toast: string | null;
  setConnection: (value: ConnectionMode) => void;
  setRole: (value: Role) => void;
  setControlMode: (value: ControlMode) => void;
  acknowledge: (id: string) => Promise<void>;
  requestFullPower: () => Promise<void>;
  reconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleNotifications: () => Promise<void>;
  notify: (message: string) => void;
}
const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: React.PropsWithChildren) {
  const [service] = useState(() => new DemoFarmService());
  const [snapshot, setSnapshot] = useState(() => service.tick());
  const [context, setContext] = useState<PreviewContext>({
    connection: 'local',
    role: 'owner',
    controlMode: 'full',
  });
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function notify(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }
  useEffect(() => {
    AsyncStorage.getItem('coopguard.notificationPreference')
      .then((value) => {
        if (value !== null) setNotifications(value === 'true');
      })
      .catch(() => {});
    const timer = setInterval(() => {
      setNow(Date.now());
      setSnapshot(service.tick());
    }, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, [service]);
  async function run(action: () => Promise<FarmSnapshot>, message?: string) {
    try {
      setSnapshot(await action());
      if (message) notify(message);
    } catch {
      notify(en.toastError);
    }
  }
  const value: FarmContextValue = {
    snapshot,
    context,
    now,
    notifications,
    toast,
    notify,
    setConnection: (connection) => setContext((previous) => ({ ...previous, connection })),
    setRole: (role) => setContext((previous) => ({ ...previous, role })),
    setControlMode: (controlMode) => setContext((previous) => ({ ...previous, controlMode })),
    acknowledge: (id) => run(() => service.acknowledge(id, context), en.toastAck),
    requestFullPower: () => run(() => service.requestFullPower(context)),
    reconnect: async () => {
      const next = { ...context, connection: 'local' as const };
      setContext(next);
      await run(() => service.simulateReconnect(next));
    },
    refresh: () => run(() => service.getSnapshot(), en.toastRefresh),
    toggleNotifications: async () => {
      try {
        await AsyncStorage.setItem('coopguard.notificationPreference', String(!notifications));
        setNotifications(!notifications);
        notify(en.toastPreference);
      } catch {
        notify(en.toastError);
      }
    },
  };
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}
export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('FarmProvider is required');
  return context;
}
