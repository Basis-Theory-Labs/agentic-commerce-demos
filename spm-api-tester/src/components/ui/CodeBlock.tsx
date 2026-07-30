"use client";

import { useState } from "react";
import { HighlightedCode, type CodeLanguage } from "@/components/ui/HighlightedCode";

// Collapsible code snippet with a language label and copy button. Highlighted
// tokens are rendered as React text nodes — no injected HTML.
export function CodeBlock({
  title,
  language = "js",
  code,
  defaultOpen = false,
}: {
  title: string;
  language?: CodeLanguage;
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
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-ink-900 transition-colors hover:bg-ink-50">
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
          className="absolute top-2 right-2 rounded-md border border-ink-300 bg-surface px-2 py-1 text-[11px] text-ink-600 transition-colors hover:border-accent/50 hover:text-ink-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="overflow-x-auto bg-screen/45 p-3 pr-16 font-mono text-xs leading-[1.55]">
          <HighlightedCode code={code} language={language} />
        </pre>
      </div>
    </details>
  );
}
