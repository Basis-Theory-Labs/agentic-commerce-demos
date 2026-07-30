"use client";

import { useEffect, useState } from "react";
import { useApiLog, type CallEntry, type CallSource } from "@/lib/apiLog";
import { CopyChip } from "@/components/ui/CopyChip";

// Inspector: full wire details for tester-owned browser/proxy calls plus
// sanitized Elements activity and SDK lifecycle events, newest first. Source
// pills make the key-placement and execution-boundary story visible.

const SOURCE_LABEL: Record<CallSource, string> = {
  browser: "browser · public key",
  server: "server · private key",
  elements: "elements",
  sdk: "sdk",
};

const SOURCE_CLASSES: Record<CallSource, string> = {
  browser: "bg-ink-50 text-ink-700 border-ink-300",
  server: "bg-ink-900 text-white border-ink-900",
  elements: "bg-white text-ink-700 border-ink-300",
  sdk: "bg-white text-ink-900 border-ink-900",
};

export default function Inspector() {
  const { entries, clear } = useApiLog();
  const [open, setOpen] = useState(false);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 bg-ink-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-ink-700"
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} API inspector (${entries.length} activity entries)`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {open ? "Hide" : "Inspector"}
        {entries.length > 0 && (
          <span className="ml-1 bg-white px-2 py-0.5 text-xs text-ink-900">{entries.length}</span>
        )}
      </button>

      <aside
        aria-label="API inspector"
        aria-hidden={!open}
        // The panel is only translated off-screen; inert keeps its controls
        // out of the tab order while hidden.
        inert={!open}
        className={`fixed top-0 right-0 z-30 h-full w-full border-l border-ink-900 bg-white shadow-xl transition-transform duration-200 ease-out sm:w-[500px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-ink-900 bg-ink-900 px-4 text-white">
          <h2 className="text-sm font-semibold text-white">API activity</h2>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                onClick={clear}
                className="border border-white/40 px-2 py-1 text-[11px] text-white/80 hover:text-white"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-white/70 hover:text-white"
              aria-label="Close inspector"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-48px)] space-y-2 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-500">
              No activity yet — Manual API calls, Elements activity, and SDK lifecycle events
              appear here.
            </div>
          ) : (
            [...entries].reverse().map((entry, reverseIndex) => (
              <InspectorRow
                key={entry.id}
                entry={entry}
                ordinal={entries.length - reverseIndex}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function InspectorRow({ entry, ordinal }: { entry: CallEntry; ordinal: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusClass =
    entry.status === undefined
      ? "text-ink-500"
      : entry.ok
        ? "text-success"
        : "text-error";

  return (
    <div className="border border-ink-200 bg-white text-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 p-2.5 text-left hover:bg-ink-50"
        aria-expanded={expanded}
      >
        <span className="w-6 shrink-0 pt-0.5 font-mono text-xs text-ink-300">
          {String(ordinal).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`border px-1.5 py-0.5 text-[10px] tracking-wide uppercase ${SOURCE_CLASSES[entry.source]}`}
            >
              {SOURCE_LABEL[entry.source]}
            </span>
            {entry.tag && (
              <span className="border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-700">
                {entry.tag}
              </span>
            )}
            {entry.pending ? (
              <span className="font-mono text-xs text-ink-400">···</span>
            ) : (
              entry.status !== undefined && (
                <span className={`font-mono text-xs font-semibold ${statusClass}`}>
                  {entry.status}
                </span>
              )
            )}
            {entry.duration_ms !== undefined && (
              <span className="text-[11px] text-ink-500">{entry.duration_ms}ms</span>
            )}
          </div>
          <div className="mt-1 font-mono text-xs break-all text-ink-900">{entry.label}</div>
        </div>
        <svg
          className={`mt-1 h-3 w-3 text-ink-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-ink-100 bg-ink-50 px-3 pb-3">
          {entry.url && <Detail label="URL" value={entry.url} />}
          {entry.request !== undefined && entry.request !== null && (
            <Detail label="Request" value={stringify(entry.request)} pre />
          )}
          {entry.response !== undefined && entry.response !== null && (
            <Detail label="Response" value={stringify(entry.response)} pre />
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {entry.traceId && (
              <span className="flex items-center gap-1 text-[10px] text-ink-500">
                bt-trace-id: <CopyChip value={entry.traceId} />
              </span>
            )}
            {entry.curl && <CopyChip value={entry.curl} label="Copy as curl" />}
          </div>
        </div>
      )}
    </div>
  );
}

function stringify(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function Detail({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div>
      <div className="mt-2 mb-1 flex items-center justify-between">
        <span className="text-[10px] tracking-wide text-ink-500 uppercase">{label}</span>
        <button
          onClick={copy}
          className="border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] text-ink-600 hover:border-ink-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={`max-h-64 overflow-auto border border-ink-100 bg-white px-2 py-1.5 font-mono text-xs text-ink-900 ${
          pre ? "whitespace-pre-wrap" : "break-all"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
