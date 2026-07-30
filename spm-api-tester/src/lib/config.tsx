"use client";

// Runtime app configuration from /api/config (non-secret) plus the
// build-time public env. `hasPrivateKey` only says whether the server key is
// configured — the key itself never reaches the browser.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AppConfig } from "@/lib/types";

interface ConfigContextValue {
  config: AppConfig | null;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({ config: null, loading: true });

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch("/api/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: AppConfig | null) => setConfig(json))
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  return <ConfigContext.Provider value={{ config, loading }}>{children}</ConfigContext.Provider>;
}

export function useAppConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
