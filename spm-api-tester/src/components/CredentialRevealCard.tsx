"use client";

import type { Credential } from "@/lib/types";
import { CopyChip } from "@/components/ui/CopyChip";
import { Callout } from "@/components/ui/Callout";

// Credential values come back from the API exactly once — they are never
// retrievable again. This card is where they land: formatted rows with a
// copy button per field, plus the warning that this is the only look.

interface FieldRow {
  label: string;
  value: string;
}

function rowsFor(credential: Credential): FieldRow[] {
  const { format, value } = credential.credential;
  if (value == null) return [];

  if (typeof value === "string") {
    return [{ label: format, value }];
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredOrder = [
      "number",
      "payment_token",
      "expiration_month",
      "expiration_year",
      "cvc",
      "cryptogram",
      "eci",
    ];
    const keys = [
      ...preferredOrder.filter((k) => k in obj),
      ...Object.keys(obj).filter((k) => !preferredOrder.includes(k)),
    ];
    const rows: FieldRow[] = [];
    for (const key of keys) {
      const item = obj[key];
      if (item == null) continue;
      if (typeof item === "object") {
        // Nested objects (the network-token `cryptogram: {type, value,
        // expires_at}`) flatten one level — the cryptogram is the field that
        // makes the token spendable and must never be dropped.
        for (const [subKey, subValue] of Object.entries(item as Record<string, unknown>)) {
          if (subValue == null || typeof subValue === "object") continue;
          rows.push({ label: `${key} ${subKey}`, value: String(subValue) });
        }
      } else {
        rows.push({ label: key, value: String(item) });
      }
    }
    return rows;
  }

  return [{ label: format, value: String(value) }];
}

export function CredentialRevealCard({ credential }: { credential: Credential }) {
  const rows = rowsFor(credential);

  return (
    <div className="surface-shadow overflow-hidden rounded-xl border border-accent/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/20 bg-accent-soft px-4 py-3.5">
        <span className="font-mono text-sm text-accent">{credential.id}</span>
        <span className="rounded-md border border-accent/30 bg-screen/20 px-2 py-1 text-[11px] font-semibold text-accent uppercase">
          {credential.credential.format}
        </span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <Callout tone="warning">
          This credential value is only shown once — it is not retrievable again. Copy what you
          need now.
        </Callout>
        {rows.length > 0 ? (
          <dl className="divide-y divide-ink-200">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                  {row.label}
                </dt>
                <dd className="min-w-0 sm:text-right">
                  <CopyChip value={row.value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs">
            {JSON.stringify(credential.credential.value, null, 2)}
          </pre>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ink-200 pt-3 text-xs text-ink-500">
          <span>
            {credential.amount?.value} {credential.amount?.currency}
          </span>
          {credential.expires_at && (
            <span>expires {credential.expires_at.slice(0, 16).replace("T", " ")}</span>
          )}
          <span className="font-mono">{credential.rail}</span>
        </div>
      </div>
    </div>
  );
}
