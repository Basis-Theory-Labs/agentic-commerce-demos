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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">SPM API Tester</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Walk the Basis Theory Shared Payment Model end to end — card token → payment method →
        allowance → verification → credentials — with every wire call visible, editable, and
        copyable.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/flow"
          className="group border border-ink-200 bg-white p-6 hover:border-ink-900"
        >
          <h2 className="text-lg font-semibold group-hover:underline">Guided Flow</h2>
          <p className="mt-2 text-sm text-ink-600">
            The five steps in order, one at a time, with editable request bodies and inline
            explanations. Deep-linkable — every step and resource id lives in the URL.
          </p>
        </Link>
        <Link
          href="/workbench"
          className="group border border-ink-200 bg-white p-6 hover:border-ink-900"
        >
          <h2 className="text-lg font-semibold group-hover:underline">Workbench</h2>
          <p className="mt-2 text-sm text-ink-600">
            Freeform, resource-oriented: create as many payment methods, allowances, and
            credentials as you want, PATCH and retry them, import external ids, and replay
            idempotency keys on purpose.
          </p>
        </Link>
      </div>

      <section className="mt-8 border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Verification flow variant</h2>
        <p className="mt-1 mb-3 text-xs text-ink-600">
          Run verification step by step against the raw API, or collapse it into the one call a
          customer would ship with{" "}
          <code className="bg-ink-100 px-1">@basis-theory/agentic-verification</code>. Both
          variants work on the same allowances — verify one each way and compare the transcripts
          in the inspector.
        </p>
        <VariantToggle />
      </section>

      <section className="mt-4 border border-ink-200 bg-white p-5 text-xs text-ink-600">
        <h2 className="mb-2 text-sm font-semibold text-ink-950">Environment</h2>
        <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt>Tenant type</dt>
            <dd className="font-mono">{config?.tenantType}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Agentic API</dt>
            <dd className="font-mono break-all">{AGENTIC_API_URL}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Display name</dt>
            <dd className="font-mono">{config?.displayName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Keys</dt>
            <dd className="font-mono">public (browser) + private (server)</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
