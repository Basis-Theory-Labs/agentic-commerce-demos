"use client";

// One payment method: card summary, rail chips, per-rail retry for failed
// rails, provider-error viewer, and (workbench) delete with cascade warning.

import { useRef, useState } from "react";
import type { PaymentMethod, ProviderErrorPage, Rail } from "@/lib/types";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useSession, type PaymentMethodEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { ScenarioChip } from "@/components/ScenarioChip";
import { ProviderErrorList } from "@/components/ProviderErrorList";
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
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errors, setErrors] = useState<ProviderErrorPage | null>(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  // A late retry response must not resurrect a payment method the user
  // deleted while the retry was in flight.
  const removed = useRef(false);

  const failedRails = (pm.rails ?? []).filter((rail: Rail) =>
    ["pending", "error"].includes(rail.status),
  );

  const retryKey = (rail: Rail) => `${rail.rail}:${rail.provider}`;
  const setRetryingFor = (key: string, active: boolean) => {
    setRetrying((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const retryRail = async (rail: Rail) => {
    const key = retryKey(rail);
    setRetryingFor(key, true);
    try {
      const updated = await callAgentic<PaymentMethod>(
        {
          method: "POST",
          path: `/payment-methods/${pm.id}/rails/retry`,
          body: { rail: rail.rail, provider: rail.provider },
          auth: "public",
          tag: "rails/retry",
        },
        logger,
      );
      if (removed.current) return;
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
      setRetryingFor(key, false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await callAgentic(
        { method: "DELETE", path: `/payment-methods/${pm.id}`, auth: "proxy" },
        logger,
      );
      removed.current = true;
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
      const result = await callAgentic<ProviderErrorPage>(
        { method: "GET", path: `/payment-methods/${pm.id}/errors`, auth: "proxy" },
        logger,
      );
      setErrors({ ...result, data: result.data ?? [] });
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
            key={retryKey(rail)}
            variant="ghost"
            small
            loading={retrying.has(retryKey(rail))}
            loadingLabel="Retrying…"
            disabled={deleting}
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
            <Button
              variant="destructive"
              small
              disabled={retrying.size > 0}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          ))}
      </div>

      {errors && (
        <div className="mt-2 border border-ink-200 bg-ink-50 p-2 text-xs">
          <ProviderErrorList
            page={errors}
            emptyLabel="No provider errors recorded for this payment method."
          />
        </div>
      )}
    </div>
  );
}
