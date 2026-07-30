"use client";

// One payment method: card summary, rail chips, per-rail retry for failed
// rails, provider-error viewer, and (workbench) delete with cascade warning.

import { useState } from "react";
import type { PaymentMethod, Rail } from "@/lib/types";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useSession, type PaymentMethodEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { ScenarioChip } from "@/components/ScenarioChip";
import { Button } from "@/components/ui/Button";
import { CopyChip } from "@/components/ui/CopyChip";
import { RailChips } from "@/components/ui/StatusPill";

export function PaymentMethodCard({
  entry,
  allowDelete = false,
}: {
  entry: PaymentMethodEntry;
  allowDelete?: boolean;
}) {
  const pm = entry.resource;
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, unknown>[] | null>(null);
  const [loadingErrors, setLoadingErrors] = useState(false);

  const failedRails = (pm.rails ?? []).filter((rail: Rail) =>
    ["pending", "error"].includes(rail.status),
  );

  const retryRail = async (rail: Rail) => {
    setRetrying(`${rail.rail}:${rail.provider}`);
    try {
      const updated = await callAgentic<PaymentMethod>(
        {
          method: "POST",
          path: `/payment-methods/${pm.id}/rails/retry`,
          body: { rail: rail.rail, provider: rail.provider },
          auth: "proxy",
          tag: "rails/retry",
        },
        logger,
      );
      dispatch({ type: "upsertPaymentMethod", entry: { ...entry, resource: updated } });
      const refreshed = updated.rails?.find(
        (r) => r.rail === rail.rail && r.provider === rail.provider,
      );
      if (refreshed?.status === "enabled") {
        toast.success(`Rail ${rail.rail} · ${rail.provider} is now enabled`);
      } else {
        toast.info(`Retry finished — ${rail.rail} · ${rail.provider} is ${refreshed?.status}`);
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setRetrying(null);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await callAgentic(
        { method: "DELETE", path: `/payment-methods/${pm.id}`, auth: "proxy" },
        logger,
      );
      dispatch({ type: "removePaymentMethod", id: pm.id });
      toast.success("Payment method deleted (its allowances were cancelled with it)");
    } catch (error) {
      toast.error(error);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const loadErrors = async () => {
    setLoadingErrors(true);
    try {
      const result = await callAgentic<{ data: Record<string, unknown>[] }>(
        { method: "GET", path: `/payment-methods/${pm.id}/errors`, auth: "proxy" },
        logger,
      );
      setErrors(result.data ?? []);
    } catch (error) {
      toast.error(error);
    } finally {
      setLoadingErrors(false);
    }
  };

  return (
    <div className="border border-ink-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <CopyChip value={pm.id} />
        <span className="font-mono text-xs text-ink-600">
          {pm.card?.brand ?? "card"} •••• {pm.card?.last4}
          {pm.card?.expiration_month != null &&
            `  ${pm.card.expiration_month}/${pm.card.expiration_year}`}
        </span>
      </div>
      <RailChips rails={pm.rails} />
      <div className="mt-2">
        <ScenarioChip scenarioPan={entry.scenarioPan} stage="payment-method" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {failedRails.map((rail) => (
          <Button
            key={`${rail.rail}:${rail.provider}`}
            variant="ghost"
            small
            loading={retrying === `${rail.rail}:${rail.provider}`}
            loadingLabel="Retrying…"
            onClick={() => retryRail(rail)}
          >
            Retry {rail.rail} · {rail.provider}
          </Button>
        ))}
        <Button variant="ghost" small loading={loadingErrors} onClick={loadErrors}>
          View provider errors
        </Button>
        {allowDelete &&
          (confirmingDelete ? (
            <>
              <span className="text-[11px] text-error">
                Deleting cancels every allowance on this payment method.
              </span>
              <Button variant="destructive" small loading={deleting} onClick={remove}>
                Confirm delete
              </Button>
              <Button variant="ghost" small onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="destructive" small onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          ))}
      </div>

      {errors && (
        <div className="mt-2 border border-ink-200 bg-ink-50 p-2 text-xs">
          {errors.length === 0 ? (
            <p className="text-ink-500">No provider errors recorded for this payment method.</p>
          ) : (
            <ul className="space-y-1.5">
              {errors.map((error, index) => (
                <li key={index} className="font-mono text-[11px] text-ink-700">
                  {String(error.type ?? "?")} · {String(error.detail ?? error.title ?? "")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
