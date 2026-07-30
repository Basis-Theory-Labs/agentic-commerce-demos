import type { Rail } from "@/lib/types";

// Tone-token driven status pills. Unknown statuses render neutrally but stay
// labeled — never a tone-less dot.
const TONE: Record<string, string> = {
  active: "border-success-border bg-success-soft text-success",
  enabled: "border-success-border bg-success-soft text-success",
  pending: "border-warning-border bg-warning-soft text-warning",
  pending_verification: "border-warning-border bg-warning-soft text-warning",
  error: "border-error-border bg-error-soft text-error",
  cancelled: "border-ink-300 bg-ink-100 text-ink-600",
  expired: "border-ink-300 bg-ink-100 text-ink-600",
};

const NEUTRAL = "border-ink-200 bg-ink-50 text-ink-700";

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${TONE[status] ?? NEUTRAL}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 bg-current" style={{ borderRadius: "50%" }} />
      {status}
    </span>
  );
}

export function RailChips({ rails }: { rails?: Rail[] }) {
  if (!rails?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rails.map((rail) => (
        <span
          key={`${rail.rail}-${rail.provider ?? ""}`}
          title={rail.error?.code}
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-xs"
        >
          <span className="font-mono font-semibold text-ink-900">{rail.rail}</span>
          {rail.provider && <span className="text-ink-500">· {rail.provider}</span>}
          <StatusPill status={rail.status} />
          {rail.status === "error" && rail.error?.code && (
            <span className="font-mono text-[11px] text-error">{rail.error.code}</span>
          )}
        </span>
      ))}
    </div>
  );
}
