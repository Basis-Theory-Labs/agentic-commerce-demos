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
    <main className="bg-dots min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-4 rounded-xl border border-ink-200 bg-surface p-4 sm:p-5">
        <div>
          <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
            SPM API Tester
          </p>
          <h1 className="text-xl font-medium">One-time setup</h1>
        </div>
        <p className="max-w-2xl text-sm text-ink-600">
          Copy <code className="bg-ink-100 px-1">.env.example</code> to{" "}
          <code className="bg-ink-100 px-1">.env.local</code>, add both application keys, and
          restart the dev server.
        </p>

        <ul className="grid gap-3 text-sm md:grid-cols-2">
          <li
            className={`rounded-lg border border-ink-200 bg-ink-50 p-3 ${
              missingPublic ? "" : "opacity-50"
            }`}
          >
            <div className="font-mono text-xs font-semibold text-ink-950">
              NEXT_PUBLIC_BT_API_KEY {missingPublic ? "— missing" : "— configured ✓"}
            </div>
            <p className="mt-2 text-xs text-ink-600">
              Public browser key with <code className="bg-ink-100 px-1">token:create</code>,{" "}
              <code className="bg-ink-100 px-1">agentic:payment-method:create</code>, and{" "}
              <code className="bg-ink-100 px-1">agentic:allowance:verify</code>.
            </p>
          </li>
          <li
            className={`rounded-lg border border-ink-200 bg-ink-50 p-3 ${
              missingPrivate ? "" : "opacity-50"
            }`}
          >
            <div className="font-mono text-xs font-semibold text-ink-950">
              BT_API_KEY {missingPrivate ? "— missing" : "— configured ✓"}
            </div>
            <div className="mt-2 text-xs text-ink-600">
              Private server key with:
              <ul className="mt-1 grid grid-cols-2 gap-x-3 font-mono text-[10px]">
                <li>agentic:payment-method:get</li>
                <li>agentic:payment-method:delete</li>
                <li>agentic:allowance:create</li>
                <li>agentic:allowance:get</li>
                <li>agentic:allowance:update</li>
                <li>agentic:allowance:delete</li>
                <li>agentic:credential:create</li>
                <li>agentic:credential:get</li>
              </ul>
            </div>
          </li>
        </ul>

        <CodeBlock
          title="Setup"
          language="bash"
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
