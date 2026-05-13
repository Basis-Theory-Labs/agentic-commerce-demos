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
const ENV = (process.env.NEXT_PUBLIC_BT_ENVIRONMENT || "test") as
  | "production"
  | "test";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { bt } = useBasisTheory(PUBLIC_KEY);

  return (
    <ApiLogProvider>
      <AgentProvider>
        <BasisTheoryProvider bt={bt}>
          <BtAiProvider apiKey={PUBLIC_KEY} environment={ENV}>
            {children}
          </BtAiProvider>
        </BasisTheoryProvider>
      </AgentProvider>
    </ApiLogProvider>
  );
}
