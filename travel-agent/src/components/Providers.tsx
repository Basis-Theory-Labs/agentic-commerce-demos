"use client";

// Wires up the two client-side SDKs (Elements + react-agentic) and the local
// API log context. Both SDKs receive the PUBLIC key only — the private key
// stays server-side in src/lib/api.ts.

import {
  BasisTheoryProvider,
  useBasisTheory,
} from "@basis-theory/react-elements";
import { BtAiProvider } from "@basis-theory/react-agentic";
import { ApiLogProvider } from "@/lib/apiLog";
import { AgentProvider } from "@/components/AgentProvider";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_BT_API_KEY || "";
const RAW_ENV = process.env.NEXT_PUBLIC_BT_ENVIRONMENT || "test";
const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

// The react-agentic SDK only knows about "production" / "test". When the demo
// runs against a local BT-compatible API ("local"), we tell the SDK we're in
// "test" mode and override the agentic base URL via `agenticApiUrl`.
const isLocal = RAW_ENV === "local";
const SDK_ENV: "production" | "test" = isLocal
  ? "test"
  : (RAW_ENV as "production" | "test");
const AGENTIC_API_URL = isLocal
  ? `${process.env.NEXT_PUBLIC_BT_LOCAL_API_URL || DEFAULT_LOCAL_API_URL}/agentic`
  : undefined;

export default function Providers({ children }: { children: React.ReactNode }) {
  const { bt } = useBasisTheory(PUBLIC_KEY);

  return (
    <ApiLogProvider>
      <AgentProvider>
        <BasisTheoryProvider bt={bt}>
          <BtAiProvider
            apiKey={PUBLIC_KEY}
            environment={SDK_ENV}
            agenticApiUrl={AGENTIC_API_URL}
          >
            {children}
          </BtAiProvider>
        </BasisTheoryProvider>
      </AgentProvider>
    </ApiLogProvider>
  );
}
