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

export function CredentialRevealCard({
  credential,
  defaultOpen = true,
}: {
  credential: Credential;
  defaultOpen?: boolean;
}) {
  const rows = rowsFor(credential);
  const format = credential.credential.format;

  return (
    <details
      open={defaultOpen}
      className="group/reveal overflow-hidden rounded-lg border border-accent/25 bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 bg-ink-50/55 px-3 py-2 text-xs transition-colors hover:bg-ink-100/70 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">
          Credential
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-ink-900">{credential.id}</span>
        <span className="hidden font-mono text-[11px] text-ink-500 sm:inline">
          {credential.amount?.value ?? "—"} {credential.amount?.currency ?? ""}
        </span>
        <span className="rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent uppercase">
          {format}
        </span>
        <span
          aria-hidden
          className="text-base leading-none text-ink-500 transition-transform group-open/reveal:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="space-y-2.5 border-t border-accent/20 p-3">
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Credential ID
          </p>
          <CopyChip value={credential.id} />
        </div>

        <Callout tone="warning">
          Shown once. Copy the spendable values before leaving this page.
        </Callout>

        {rows.length > 0 ? (
          <dl className="grid overflow-hidden rounded-lg border border-ink-200 bg-ink-50/35 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex min-w-0 items-center justify-between gap-3 border-b border-ink-200 px-3 py-2 last:border-b-0 sm:[&:nth-child(odd)]:border-r"
              >
                <dt className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                  {row.label.replaceAll("_", " ")}
                </dt>
                <dd className="min-w-0 text-right">
                  <CopyChip value={row.value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs">
            <HighlightedCode
              code={JSON.stringify(credential.credential.value, null, 2)}
              language="json"
            />
          </pre>
        )}

        <dl className="grid gap-2 border-t border-ink-200 pt-2.5 text-xs sm:grid-cols-2">
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
    </details>
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
      <dt className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-ink-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
