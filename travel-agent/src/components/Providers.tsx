"use client";

import {
  BasisTheoryProvider,
  useBasisTheory,
} from "@basis-theory/react-elements";
import { BtAiProvider } from "@basis-theory/react-agentic";
import { ApiLogProvider } from "@/lib/apiLog";
import { AgentProvider } from "@/components/AgentProvider";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_BT_API_KEY || "";
const ENVIRONMENT: "production" | "test" =
  process.env.NEXT_PUBLIC_BT_ENVIRONMENT === "production"
    ? "production"
    : "test";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { bt } = useBasisTheory(PUBLIC_KEY);

  return (
    <ApiLogProvider>
      <AgentProvider>
        <BasisTheoryProvider bt={bt}>
          <BtAiProvider apiKey={PUBLIC_KEY} environment={ENVIRONMENT}>
            {children}
          </BtAiProvider>
        </BasisTheoryProvider>
      </AgentProvider>
    </ApiLogProvider>
  );
}
