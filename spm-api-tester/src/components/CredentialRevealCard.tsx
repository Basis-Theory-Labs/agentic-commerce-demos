"use client";

import type { Credential } from "@/lib/types";
import { CopyChip } from "@/components/ui/CopyChip";
import { Callout } from "@/components/ui/Callout";
import { HighlightedCode } from "@/components/ui/HighlightedCode";

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
  const format = credential.credential.format;
  const isCard = format === "card" && rows.some((row) => row.label === "number");

  return (
    <div className="surface-shadow overflow-hidden rounded-xl border border-ink-200 bg-surface">
      <div className="grid gap-4 border-b border-ink-200 bg-ink-50/45 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-5">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Credential ID
          </p>
          <CopyChip value={credential.id} />
        </div>
        <div className="sm:text-right">
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Format
          </p>
          <span className="rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent uppercase">
            {format}
          </span>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <Callout tone="warning">
          This credential value is only shown once — it is not retrievable again. Copy what you need
          now.
        </Callout>

        {isCard && <CardCredentialPreview rows={rows} />}

        {rows.length > 0 ? (
          <details
            className="group overflow-hidden rounded-xl border border-ink-200 bg-ink-50/35"
            open={!isCard}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-50">
              <span>Credential fields</span>
              <span className="flex items-center gap-2 text-xs font-normal text-ink-500">
                {rows.length} {rows.length === 1 ? "value" : "values"}
                <span className="transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            <dl className="divide-y divide-ink-200 border-t border-ink-200 bg-surface px-4">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                    {row.label.replaceAll("_", " ")}
                  </dt>
                  <dd className="min-w-0 sm:text-right">
                    <CopyChip value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs">
            <HighlightedCode
              code={JSON.stringify(credential.credential.value, null, 2)}
              language="json"
            />
          </pre>
        )}

        <dl className="grid gap-3 border-t border-ink-200 pt-4 text-xs sm:grid-cols-3">
          <CredentialMeta
            label="Amount"
            value={`${credential.amount?.value ?? "—"} ${credential.amount?.currency ?? ""}`}
          />
          <CredentialMeta
            label="Expires"
            value={
              credential.expires_at ? credential.expires_at.slice(0, 16).replace("T", " ") : "—"
            }
          />
          <CredentialMeta
            label="Rail"
            value={`${credential.rail}${credential.provider ? ` · ${credential.provider}` : ""}`}
            mono
          />
        </dl>
      </div>
    </div>
  );
}

function CardCredentialPreview({ rows }: { rows: FieldRow[] }) {
  const value = (label: string) => rows.find((row) => row.label === label)?.value ?? "—";
  const number = value("number");
  const displayNumber = number.replace(/(\d{4})(?=\d)/g, "$1 ");
  const month = value("expiration_month").padStart(2, "0");
  const year = value("expiration_year");
  const cvc = value("cvc");

  return (
    <div className="relative isolate max-w-xl overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-[#1a3031] via-surface-raised to-screen p-5 shadow-2xl sm:p-6">
      <div
        aria-hidden
        className="absolute -top-24 -right-20 -z-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
            Single-use card
          </p>
          <p className="mt-1 text-xs text-ink-500">Agentic payment credential</p>
        </div>
        <span className="font-mono text-sm font-semibold text-accent">bt/</span>
      </div>

      <div className="mt-8">
        <p className="mb-1.5 text-[10px] tracking-wide text-ink-500 uppercase">Card number</p>
        <CopyChip
          value={number}
          label={displayNumber}
          className="w-full justify-between border-white/10 bg-black/20 px-3 py-2 text-base tracking-[0.08em] text-ink-950 sm:text-lg"
        />
      </div>

      <div className="mt-5 grid max-w-sm grid-cols-2 gap-4">
        <div>
          <p className="mb-1.5 text-[10px] tracking-wide text-ink-500 uppercase">Expires</p>
          <CopyChip
            value={`${month}/${year}`}
            className="border-white/10 bg-black/20 text-ink-900"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] tracking-wide text-ink-500 uppercase">CVC</p>
          <CopyChip value={cvc} className="border-white/10 bg-black/20 text-ink-900" />
        </div>
      </div>
    </div>
  );
}

function CredentialMeta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-ink-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
