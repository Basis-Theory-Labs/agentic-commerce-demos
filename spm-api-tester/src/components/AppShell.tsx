"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppConfig } from "@/lib/config";
import { useResetSession } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { AGENTIC_API_URL } from "@/lib/env";
import { SetupScreen, useSetupState } from "@/components/SetupScreen";
import Inspector from "@/components/Inspector";

export function EnvironmentContext({
  displayName,
  apiUrl,
  tenantType,
}: {
  displayName: string;
  apiUrl: string;
  tenantType: "test" | "production";
}) {
  const isProduction = tenantType === "production";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="hidden min-w-0 items-center gap-2 text-[11px] xl:flex"
        title={`${displayName} · ${apiUrl}`}
      >
        <span className="max-w-40 truncate font-medium text-ink-800">
          <span className="sr-only">Agent: </span>
          {displayName}
        </span>
        <span className="text-ink-400">·</span>
        <span className="max-w-56 truncate font-mono text-ink-500">
          <span className="sr-only">API endpoint: </span>
          {apiUrl}
        </span>
      </div>
      <span
        aria-label={`Environment: ${isProduction ? "Production tenant" : "Test tenant"}`}
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
          isProduction
            ? "border-warning-border bg-warning-soft text-warning"
            : "border-ink-200 bg-surface text-ink-700"
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${isProduction ? "bg-warning" : "bg-ink-500"}`}
        />
        <span className="hidden lg:inline">
          {isProduction ? "Production tenant" : "Test tenant"}
        </span>
        <span className="lg:hidden">{isProduction ? "Prod" : "Test"}</span>
      </span>
    </div>
  );
}

// Common chrome: customer-portal visual language, mode navigation, environment
// context, reset-session, and a persistent desktop inspector. Renders the
// setup screen when keys are missing so every route stays safe on a fresh
// checkout.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { config, loading } = useAppConfig();
  const setup = useSetupState();
  const pathname = usePathname();
  const resetSession = useResetSession();
  const toast = useToast();
  const showInspector = pathname !== "/";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-screen text-sm text-ink-500">
        Loading configuration…
      </main>
    );
  }
  if (setup.needsSetup) {
    return (
      <SetupScreen missingPrivate={setup.missingPrivate} missingPublic={setup.missingPublic} />
    );
  }

  const navClass = (href: string) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      pathname.startsWith(href)
        ? "bg-ink-950 text-screen"
        : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
    }`;

  return (
    <div className="min-h-screen bg-screen">
      <header className="border-b border-ink-200 bg-screen/95 md:sticky md:top-0 md:z-50 md:backdrop-blur-xl">
        <div className="flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 lg:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-950 font-mono text-[10px] font-semibold text-screen transition-transform group-hover:scale-[1.03]"
            >
              bt/
            </span>
            <span className="flex flex-col">
              <span className="text-[10px] font-medium text-ink-500">Basis Theory</span>
              <span className="font-display text-xs font-semibold text-ink-950">
                SPM API Tester
              </span>
            </span>
          </Link>
          <nav
            aria-label="Modes"
            className="order-3 flex w-full gap-0.5 rounded-lg border border-ink-200 bg-surface p-0.5 sm:order-none sm:w-auto"
          >
            <Link href="/flow" className={navClass("/flow")}>
              Guided Flow
            </Link>
            <Link href="/workbench" className={navClass("/workbench")}>
              Workbench
            </Link>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <EnvironmentContext
              displayName={config?.displayName || "Example Agent"}
              apiUrl={AGENTIC_API_URL}
              tenantType={config?.tenantType || "production"}
            />
            <button
              type="button"
              onClick={() => {
                resetSession();
                toast.info("Session reset", "All session resources were forgotten locally.");
              }}
              aria-label="Reset session"
              className="flex h-7 w-7 items-center justify-center gap-2 rounded-md border border-ink-300 bg-surface text-ink-600 transition-colors hover:border-ink-400 hover:bg-ink-50 hover:text-ink-900 sm:h-auto sm:w-auto sm:px-2 sm:py-1 sm:text-[11px] sm:font-medium"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 9a7.5 7.5 0 111.88 7.25M4.5 9V4.5M4.5 9H9"
                />
              </svg>
              <span className="hidden md:inline">Reset session</span>
            </button>
          </div>
        </div>
      </header>
      <div className={showInspector ? "grid w-full 2xl:grid-cols-[minmax(0,1fr)_560px]" : "w-full"}>
        <div className="min-w-0">{children}</div>
        {showInspector && <Inspector />}
      </div>
    </div>
  );
}
