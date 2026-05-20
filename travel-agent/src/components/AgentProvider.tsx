"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLoggedFetch } from "@/lib/apiLog";

interface AgentContextValue {
  agentId: string | null;
  error: string | null;
}

const AgentContext = createContext<AgentContextValue>({
  agentId: null,
  error: null,
});

const AGENT_NAME = "SkyAgent";

function storageKey(): string {
  const env = process.env.NEXT_PUBLIC_BT_ENVIRONMENT || "test";
  return `skyagent.agentId.${env}`;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const loggedFetch = useLoggedFetch();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey());
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAgentId(stored);
        return;
      }
    }

    (async () => {
      try {
        const res = await loggedFetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: AGENT_NAME }),
          label: "POST /api/agents",
          step: "bootstrap-agent",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create agent");
        window.localStorage.setItem(storageKey(), data.id);
        setAgentId(data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create agent");
      }
    })();
  }, [loggedFetch]);

  return (
    <AgentContext.Provider value={{ agentId, error }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentContextValue {
  return useContext(AgentContext);
}
