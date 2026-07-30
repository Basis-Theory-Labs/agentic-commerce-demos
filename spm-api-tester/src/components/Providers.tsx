"use client";

import { BasisTheoryProvider, useBasisTheory } from "@basis-theory/react-elements";
import { ApiLogProvider } from "@/lib/apiLog";
import { ConfigProvider } from "@/lib/config";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/lib/toast";
import { PUBLIC_KEY } from "@/lib/env";

export default function Providers({ children }: { children: React.ReactNode }) {
  // One Elements instance for the whole app; children read it via context.
  const { bt } = useBasisTheory(PUBLIC_KEY || undefined);

  return (
    <ConfigProvider>
      <ApiLogProvider>
        <ToastProvider>
          <SessionProvider>
            <BasisTheoryProvider bt={bt}>{children}</BasisTheoryProvider>
          </SessionProvider>
        </ToastProvider>
      </ApiLogProvider>
    </ConfigProvider>
  );
}
