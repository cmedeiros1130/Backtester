import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Settings = {
  default_instrument: string;
  default_timeframe: string;
  market_timezone: string;
  [k: string]: string;
};

type Ctx = {
  settings: Settings;
  save: (patch: Partial<Settings>) => Promise<void>;
  ready: boolean;
};

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

const DEFAULTS: Settings = {
  default_instrument: 'NQ',
  default_timeframe: '5m',
  market_timezone: 'America/New_York',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get<Settings>('/settings')
      .then((s) => setSettings({ ...DEFAULTS, ...s }))
      .catch(() => { /* first run with no server settings yet - defaults stand */ })
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (patch: Partial<Settings>) => {
    const next = await api.put<Settings>('/settings', patch);
    setSettings({ ...DEFAULTS, ...next });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ settings, save, ready }),
    [settings, save, ready]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/**
 * Data hook with an explicit reload handle. Small and deliberate: the app has
 * a handful of screens, each of which owns one request, so a full query cache
 * would be more machinery than the problem needs.
 */
export function useFetch<T>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const key = JSON.stringify([url, deps, nonce]);
  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get<T>(url)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1), setData };
}

/** POST-based fetch, used by the research screens whose filters are a body. */
export function usePost<T>(url: string | null, body: any) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const key = JSON.stringify([url, body, nonce]);
  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.post<T>(url, body)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
