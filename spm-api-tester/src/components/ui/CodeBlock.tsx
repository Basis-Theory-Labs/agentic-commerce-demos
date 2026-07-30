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
    <details className="group border border-ink-200 bg-white" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-ink-900 hover:bg-ink-50">
        <span>
          Code — {title}
          <span className="ml-2 border border-ink-200 bg-ink-50 px-1 py-0.5 font-mono text-[10px] text-ink-500">
            {language}
          </span>
        </span>
        <span className="text-ink-400 group-open:rotate-90">›</span>
      </summary>
      <div className="relative border-t border-ink-200">
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] text-ink-600 hover:border-ink-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="overflow-x-auto bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-800">
          {code}
        </pre>
      </div>
    </details>
  );
}
