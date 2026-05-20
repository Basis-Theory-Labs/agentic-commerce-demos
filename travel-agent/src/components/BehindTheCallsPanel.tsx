"use client";

import { useApiLog, type CallEntry, type CallSource } from "@/lib/apiLog";
import { useEffect, useRef, useState } from "react";

const SOURCE_LABEL: Record<CallSource, string> = {
  browser: "Browser → API route",
  server: "Server → Basis Theory",
  sdk: "react-agentic SDK",
  elements: "react-elements SDK",
};

const SOURCE_COLOR: Record<CallSource, string> = {
  browser: "bg-ink-50 text-ink-700 border-ink-200",
  server: "bg-ink-900 text-white border-ink-900",
  sdk: "bg-white text-ink-900 border-ink-900",
  elements: "bg-white text-ink-700 border-ink-300",
};

function statusColor(entry: CallEntry): string {
  if (entry.status === undefined) return "text-ink-500";
  if (entry.ok) return "text-ink-900";
  return "text-error";
}

export default function BehindTheCallsPanel() {
  const { entries } = useApiLog();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const env = process.env.NEXT_PUBLIC_BT_ENVIRONMENT || "test";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 bg-ink-900 text-white text-sm font-medium rounded-full px-4 py-2.5 shadow-lg hover:bg-ink-700 transition-colors flex items-center gap-2"
        aria-label="Toggle behind-the-calls panel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {open ? "Hide" : "Show"} API calls
        {entries.length > 0 && (
          <span className="bg-white text-ink-900 text-xs rounded-full px-2 py-0.5 ml-1">
            {entries.length}
          </span>
        )}
      </button>

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white border-l border-ink-900 shadow-xl z-30 transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 bg-ink-900 text-white h-14 border-l border-white/30">
          <h2 className="font-semibold text-white">API Calls</h2>
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] uppercase tracking-wide px-2 py-1 font-medium ${
                env === "production"
                  ? "bg-white text-ink-900"
                  : "border border-white/40 text-white/80"
              }`}
            >
              {env}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white p-1"
              aria-label="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="overflow-y-auto h-[calc(100%-56px)] p-3 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center text-ink-500 text-sm py-12">
              No calls yet — interact with the demo to see what fires.
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isOpen = expanded.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="border border-ink-100 rounded-lg bg-white text-sm overflow-hidden"
                >
                  <button
                    onClick={() => toggle(entry.id)}
                    className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-ink-50"
                  >
                    <span className="font-mono text-xs text-ink-300 pt-0.5 w-6 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${SOURCE_COLOR[entry.source]}`}
                        >
                          {SOURCE_LABEL[entry.source]}
                        </span>
                        {entry.status !== undefined && (
                          <span className={`text-xs font-mono ${statusColor(entry)}`}>
                            {entry.status}
                          </span>
                        )}
                        {entry.duration_ms !== undefined && (
                          <span className="text-[11px] text-ink-500">
                            {entry.duration_ms}ms
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-ink-900 mt-1 break-all">
                        {entry.label}
                      </div>
                      {entry.step && (
                        <div className="text-[11px] text-ink-500 mt-0.5">
                          step: {entry.step}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-3 h-3 text-ink-500 mt-1 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-ink-100 bg-ink-50">
                      {entry.url && (
                        <DetailBlock label="URL" value={entry.url} mono />
                      )}
                      {entry.request !== undefined && entry.request !== null && (
                        <DetailBlock
                          label="Request"
                          value={
                            typeof entry.request === "string"
                              ? entry.request
                              : JSON.stringify(entry.request, null, 2)
                          }
                          mono
                          pre
                        />
                      )}
                      {entry.response !== undefined && entry.response !== null && (
                        <DetailBlock
                          label="Response"
                          value={
                            typeof entry.response === "string"
                              ? entry.response
                              : JSON.stringify(entry.response, null, 2)
                          }
                          mono
                          pre
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

function DetailBlock({
  label,
  value,
  mono,
  pre,
}: {
  label: string;
  value: string;
  mono?: boolean;
  pre?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500 mt-2 mb-1">
        {label}
      </div>
      <div
        className={`${mono ? "font-mono" : ""} text-xs text-ink-900 bg-white border border-ink-100 rounded px-2 py-1.5 ${
          pre ? "whitespace-pre-wrap" : "break-all"
        } max-h-64 overflow-auto`}
      >
        {value}
      </div>
    </div>
  );
}
