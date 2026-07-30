"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <AppShell>
      <Landing />
    </AppShell>
  );
}

function Landing() {
  return (
    <main className="mx-auto max-w-[960px] px-4 py-6 pb-16 sm:px-6">
      <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
        Shared Payment Model
      </p>
      <h1 className="text-[22px] font-medium">SPM API Tester</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        Run the complete card-to-credential flow, or work directly with any resource.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Link
          href="/flow"
          className="group rounded-xl border border-ink-200 bg-surface p-4 transition-colors hover:border-accent/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-950">Guided Flow</h2>
              <p className="mt-1 text-xs text-ink-600">Complete the five SPM steps in order.</p>
            </div>
            <span className="text-sm text-accent" aria-hidden>
              →
            </span>
          </div>
        </Link>
        <Link
          href="/workbench"
          className="group rounded-xl border border-ink-200 bg-surface p-4 transition-colors hover:border-accent/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-950">Workbench</h2>
              <p className="mt-1 text-xs text-ink-600">
                Create, import, and mutate resources freely.
              </p>
            </div>
            <span className="text-sm text-accent" aria-hidden>
              →
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
}
