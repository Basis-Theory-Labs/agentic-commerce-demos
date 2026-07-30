"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppConfig } from "@/lib/config";
import { useResetSession } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { AGENTIC_API_URL } from "@/lib/env";
import { SetupScreen, useSetupState } from "@/components/SetupScreen";
import Inspector from "@/components/Inspector";

// Common chrome: header with the product name, environment chip, mode nav,
// reset-session, plus the inspector. Renders the setup screen when keys are
// missing so every route stays safe on a fresh checkout.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { config, loading } = useAppConfig();
  const setup = useSetupState();
  const pathname = usePathname();
  const resetSession = useResetSession();
  const toast = useToast();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-500">
        Loading configuration…
      </main>
    );
  }
  if (setup.needsSetup) {
    return <SetupScreen missingPrivate={setup.missingPrivate} missingPublic={setup.missingPublic} />;
  }

  const navClass = (href: string) =>
    `px-3 py-1.5 text-xs font-medium ${
      pathname.startsWith(href) ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
    }`;

  return (
    <div className="bg-dots min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-sm font-semibold text-ink-950">
            SPM API Tester
          </Link>
          <nav aria-label="Modes" className="flex gap-1">
            <Link href="/flow" className={navClass("/flow")}>
              Guided Flow
            </Link>
            <Link href="/workbench" className={navClass("/workbench")}>
              Workbench
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden font-mono text-[10px] text-ink-500 md:inline"
              title="Agentic API base URL"
            >
              {AGENTIC_API_URL}
            </span>
            <span
              className={`border px-1.5 py-0.5 text-[10px] uppercase ${
                config?.tenantType === "production"
                  ? "border-warning-border bg-warning-soft text-warning"
                  : "border-ink-300 bg-ink-50 text-ink-600"
              }`}
            >
              {config?.tenantType}
            </span>
            <button
              onClick={() => {
                resetSession();
                toast.info("Session reset", "All session resources were forgotten locally.");
              }}
              className="border border-ink-300 px-2 py-1 text-[11px] text-ink-600 hover:border-ink-900 hover:text-ink-900"
            >
              Reset session
            </button>
          </div>
        </div>
      </header>
      {children}
      <Inspector />
    </div>
  );
}
