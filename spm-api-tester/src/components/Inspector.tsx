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
  server: "bg-accent-soft text-accent border-accent/30",
  elements: "bg-success-soft text-success border-success-border",
  sdk: "bg-warning-soft text-warning border-warning-border",
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
      <aside
        aria-label="API inspector"
        className="sticky top-18 hidden h-[calc(100vh-4.5rem)] min-h-[560px] flex-col border-l border-ink-200 bg-surface xl:flex"
      >
        <InspectorPanel entries={entries} clear={clear} />
      </aside>

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-xl transition-colors hover:bg-accent-hover xl:hidden"
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} API inspector (${entries.length} activity entries)`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {open ? "Hide" : "Inspector"}
        {entries.length > 0 && (
          <span className="ml-1 rounded-md bg-accent-foreground px-2 py-0.5 text-xs text-accent">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close API inspector"
          className="fixed inset-0 z-40 rounded-none bg-black/60 backdrop-blur-sm xl:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        aria-label="API inspector"
        aria-hidden={!open}
        // The panel is only translated off-screen; inert keeps its controls
        // out of the tab order while hidden.
        inert={!open}
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-ink-200 bg-surface shadow-2xl transition-transform duration-200 ease-out sm:w-[540px] xl:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <InspectorPanel entries={entries} clear={clear} onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}

function InspectorPanel({
  entries,
  clear,
  onClose,
}: {
  entries: CallEntry[];
  clear: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex min-h-18 items-center justify-between gap-4 border-b border-ink-200 bg-surface px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink-950">API activity</h2>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700">
              {entries.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">Newest first · select a call for wire details</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs text-ink-600 transition-colors hover:border-accent/50 hover:text-ink-900"
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
              aria-label="Close inspector"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-screen/35 p-4">
        {entries.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 px-8 text-center">
            <span
              aria-hidden
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-ink-800">Waiting for your first call</p>
            <p className="mt-1 text-xs text-ink-500">
              Manual requests, Elements activity, and SDK lifecycle events will appear here.
            </p>
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
    <div className="surface-shadow overflow-hidden rounded-xl border border-ink-200 bg-surface text-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 rounded-none p-3.5 text-left transition-colors hover:bg-ink-50"
        aria-expanded={expanded}
      >
        <span className="w-6 shrink-0 pt-0.5 font-mono text-xs text-ink-400">
          {String(ordinal).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide uppercase ${SOURCE_CLASSES[entry.source]}`}
            >
              {SOURCE_LABEL[entry.source]}
            </span>
            {entry.tag && (
              <span className="rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 font-mono text-xs text-ink-700">
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
              <span className="text-xs text-ink-500">{entry.duration_ms}ms</span>
            )}
          </div>
          <div className="mt-1.5 font-mono text-xs break-all text-ink-900">{entry.label}</div>
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
        <div className="space-y-2 border-t border-ink-200 bg-ink-50 px-4 pb-4">
          {entry.url && <Detail label="URL" value={entry.url} />}
          {entry.request !== undefined && entry.request !== null && (
            <Detail label="Request" value={stringify(entry.request)} pre />
          )}
          {entry.response !== undefined && entry.response !== null && (
            <Detail label="Response" value={stringify(entry.response)} pre />
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {entry.traceId && (
              <span className="flex items-center gap-1 text-xs text-ink-500">
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
        <span className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</span>
        <button
          onClick={copy}
          className="rounded-md border border-ink-300 bg-surface px-2 py-0.5 text-xs text-ink-600 transition-colors hover:border-accent/50 hover:text-ink-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={`max-h-72 overflow-auto rounded-lg border border-ink-200 bg-surface px-3 py-2.5 font-mono text-xs text-ink-900 ${
          pre ? "whitespace-pre-wrap" : "break-all"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
