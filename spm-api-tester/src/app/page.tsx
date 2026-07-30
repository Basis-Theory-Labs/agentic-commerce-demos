"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { VariantToggle } from "@/lib/variant";
import { useAppConfig } from "@/lib/config";
import { AGENTIC_API_URL } from "@/lib/env";

export default function Home() {
  return (
    <AppShell>
      <Landing />
    </AppShell>
  );
}

function Landing() {
  const { config } = useAppConfig();

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-10 pb-24 sm:px-8 lg:px-10 lg:py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
        Shared Payment Model
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold sm:text-5xl">
        Build and inspect the complete agentic payment flow.
      </h1>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink-600">
        Walk the Basis Theory Shared Payment Model end to end — card token → payment method →
        allowance → verification → credentials. Manual API requests are visible, editable, and
        copyable; Elements and SDK activity is shown as sanitized events.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Link
          href="/flow"
          className="surface-shadow group rounded-2xl border border-ink-200 bg-surface p-6 transition-colors hover:border-accent/50 sm:p-7"
        >
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-foreground">
            01
          </span>
          <h2 className="text-xl font-semibold text-ink-950">Guided Flow</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            The five steps in order, one at a time, with editable request bodies and inline
            explanations. Deep-linkable — every step and resource id lives in the URL.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Start the flow <span aria-hidden>→</span>
          </span>
        </Link>
        <Link
          href="/workbench"
          className="surface-shadow group rounded-2xl border border-ink-200 bg-surface p-6 transition-colors hover:border-accent/50 sm:p-7"
        >
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent">
            02
          </span>
          <h2 className="text-xl font-semibold text-ink-950">Workbench</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            Freeform, resource-oriented: create as many payment methods, allowances, and
            credentials as you want, PATCH and retry them, import external ids, and replay
            idempotency keys on purpose.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Open the workbench <span aria-hidden>→</span>
          </span>
        </Link>
      </div>

      <section className="mt-6 rounded-xl border border-ink-200 bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Verification flow variant</h2>
        <p className="mt-2 mb-4 max-w-3xl text-sm leading-relaxed text-ink-600">
          Run verification step by step against the raw API, or collapse it into the one call a
          customer would ship with{" "}
          <code className="bg-ink-100 px-1">@basis-theory/web-agentic</code>. Both
          variants work on the same allowances — verify one each way and compare the Manual wire
          timeline with the SDK lifecycle in the inspector.
        </p>
        <VariantToggle />
      </section>

      <section className="mt-4 rounded-xl border border-ink-200 bg-surface p-5 text-sm text-ink-600 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink-950">Environment</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-lg bg-ink-50 px-3 py-2.5">
            <dt>Tenant type</dt>
            <dd className="font-mono">{config?.tenantType}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg bg-ink-50 px-3 py-2.5">
            <dt>Agentic API</dt>
            <dd className="font-mono break-all">{AGENTIC_API_URL}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg bg-ink-50 px-3 py-2.5">
            <dt>Display name</dt>
            <dd className="font-mono">{config?.displayName}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg bg-ink-50 px-3 py-2.5">
            <dt>Keys</dt>
            <dd className="font-mono">public (browser) + private (server)</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
