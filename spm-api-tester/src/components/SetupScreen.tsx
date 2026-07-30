"use client";

// Full-page setup screen shown when either key is missing. Says exactly
// which env var to set and which permissions each application needs.

import { HAS_PUBLIC_KEY } from "@/lib/env";
import { useAppConfig } from "@/lib/config";
import { CodeBlock } from "@/components/ui/CodeBlock";

export function useSetupState() {
  const { config, loading } = useAppConfig();
  const missingPrivate = !loading && !(config?.hasPrivateKey ?? false);
  const missingPublic = !HAS_PUBLIC_KEY;
  return { loading, missingPrivate, missingPublic, needsSetup: missingPrivate || missingPublic };
}

export function SetupScreen({
  missingPrivate,
  missingPublic,
}: {
  missingPrivate: boolean;
  missingPublic: boolean;
}) {
  return (
    <main className="bg-dots min-h-screen px-4 py-16">
      <div className="mx-auto max-w-xl space-y-5 border border-ink-200 bg-white p-8">
        <h1 className="text-2xl font-semibold">One-time setup</h1>
        <p className="text-sm text-ink-600">
          The SPM API Tester needs two Basis Theory application keys before it can run. Copy{" "}
          <code className="bg-ink-100 px-1">.env.example</code> to{" "}
          <code className="bg-ink-100 px-1">.env.local</code>, set the values below, and restart
          the dev server.
        </p>

        <ul className="space-y-3 text-sm">
          <li className={missingPublic ? "" : "opacity-50"}>
            <div className="font-mono text-xs font-semibold text-ink-950">
              NEXT_PUBLIC_BT_API_KEY {missingPublic ? "— missing" : "— configured ✓"}
            </div>
            <p className="mt-1 text-xs text-ink-600">
              A <b>public</b> application key. It runs in the browser (that is what public keys
              are for) and needs the permissions{" "}
              <code className="bg-ink-100 px-1">token:create</code>,{" "}
              <code className="bg-ink-100 px-1">agentic:payment-method:create</code>,{" "}
              <code className="bg-ink-100 px-1">agentic:allowance:verify</code>, and{" "}
              <code className="bg-ink-100 px-1">agentic:allowance:get</code>.
            </p>
          </li>
          <li className={missingPrivate ? "" : "opacity-50"}>
            <div className="font-mono text-xs font-semibold text-ink-950">
              BT_API_KEY {missingPrivate ? "— missing" : "— configured ✓"}
            </div>
            <p className="mt-1 text-xs text-ink-600">
              A <b>private</b> application key. It never leaves the Next.js server and covers
              payment-method management (
              <code className="bg-ink-100 px-1">agentic:payment-method:*</code>), allowance
              management (<code className="bg-ink-100 px-1">agentic:allowance:*</code>), and
              credentials (<code className="bg-ink-100 px-1">agentic:credential:*</code>).
            </p>
          </li>
        </ul>

        <CodeBlock
          title="Setup"
          language="bash"
          defaultOpen
          code={[
            "cp .env.example .env.local",
            "# set NEXT_PUBLIC_BT_API_KEY and BT_API_KEY (test tenant recommended)",
            "npm run dev",
          ].join("\n")}
        />
      </div>
    </main>
  );
}
