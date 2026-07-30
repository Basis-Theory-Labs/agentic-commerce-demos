"use client";

import { useState } from "react";

// Collapsible code snippet with a language label and copy button. All code
// rendered through textContent — no innerHTML, no highlighting dependency.
export function CodeBlock({
  title,
  language = "js",
  code,
  defaultOpen = false,
}: {
  title: string;
  language?: string;
  code: string;
  defaultOpen?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <details
      className="group overflow-hidden rounded-xl border border-ink-200 bg-surface"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50">
        <span>
          Code — {title}
          <span className="ml-2 rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] font-normal text-ink-500">
            {language}
          </span>
        </span>
        <span className="text-ink-400 group-open:rotate-90">›</span>
      </summary>
      <div className="relative border-t border-ink-200">
        <button
          type="button"
          onClick={copy}
          className="absolute top-3 right-3 rounded-md border border-ink-300 bg-surface px-2 py-1 text-[11px] text-ink-600 transition-colors hover:border-accent/50 hover:text-ink-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="overflow-x-auto bg-screen/45 p-4 font-mono text-xs leading-relaxed text-ink-800">
          {code}
        </pre>
      </div>
    </details>
  );
}
