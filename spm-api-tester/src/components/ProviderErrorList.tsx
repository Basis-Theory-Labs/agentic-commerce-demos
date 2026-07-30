"use client";

import type { ProviderErrorPage, ProviderErrorRecord } from "@/lib/types";
import { Callout } from "@/components/ui/Callout";
import { CopyChip } from "@/components/ui/CopyChip";

const SUPPORT_IDS: Array<[keyof ProviderErrorRecord, string]> = [
  ["provider_correlation_id", "provider correlation"],
  ["provider_code", "provider code"],
  ["payment_credential_id", "credential attempt"],
  ["allowance_id", "allowance"],
  ["payment_method_id", "payment method"],
];

export function ProviderErrorList({
  page,
  emptyLabel,
}: {
  page: ProviderErrorPage;
  emptyLabel: string;
}) {
  if (page.data.length === 0) {
    return <p className="text-ink-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {page.data.map((error, index) => (
        <details
          key={error.id ?? `${error.code ?? "provider-error"}-${index}`}
          className="rounded-lg border border-ink-200 bg-surface p-3"
          open={index === 0}
        >
          <summary className="cursor-pointer font-mono text-xs text-ink-800">
            {error.code ?? "PROVIDER_ERROR"} · {error.provider ?? "provider"}
            {error.operation ? ` · ${error.operation}` : ""}
            {error.rail ? `/${error.rail}` : ""}
          </summary>
          <div className="mt-3 space-y-2">
            {error.title && <p className="text-xs font-medium text-ink-900">{error.title}</p>}
            {error.detail && <p className="text-xs text-ink-700">{error.detail}</p>}
            {error.occurred_at && (
              <p className="font-mono text-[11px] text-ink-500">{error.occurred_at}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SUPPORT_IDS.map(([field, label]) => {
                const value = error[field];
                return typeof value === "string" && value ? (
                  <CopyChip key={field} value={value} label={`${label}: ${value}`} />
                ) : null;
              })}
            </div>
          </div>
        </details>
      ))}
      {page.pagination?.has_more && (
        <Callout tone="warning">
          More provider errors exist after this first page. Copy the request from the inspector and
          follow <code>pagination.next_cursor</code> to retrieve the rest.
          {page.pagination.next_cursor && (
            <span className="mt-1 block">
              <CopyChip
                value={page.pagination.next_cursor}
                label={`next cursor: ${page.pagination.next_cursor}`}
              />
            </span>
          )}
        </Callout>
      )}
    </div>
  );
}
