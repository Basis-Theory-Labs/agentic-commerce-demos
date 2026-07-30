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
    return [{ label: format === "identifier" ? "identifier" : format, value }];
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
    return keys
      .filter((k) => obj[k] != null && typeof obj[k] !== "object")
      .map((k) => ({ label: k, value: String(obj[k]) }));
  }

  return [{ label: format, value: String(value) }];
}

export function CredentialRevealCard({ credential }: { credential: Credential }) {
  const rows = rowsFor(credential);

  return (
    <div className="border border-ink-900 bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 bg-ink-900 px-3 py-2">
        <span className="font-mono text-xs text-white">{credential.id}</span>
        <span className="border border-white/40 px-1.5 py-0.5 text-[10px] text-white/90 uppercase">
          {credential.credential.format}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <Callout tone="warning">
          This credential value is only shown once — it is not retrievable again. Copy what you
          need now.
        </Callout>
        <dl className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-[11px] tracking-wide text-ink-500 uppercase">{row.label}</dt>
              <dd className="min-w-0">
                <CopyChip value={row.value} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-2 text-[11px] text-ink-500">
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
