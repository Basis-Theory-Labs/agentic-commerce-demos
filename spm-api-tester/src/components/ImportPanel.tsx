"use client";

// Paste-an-id importer: fetches the resource and adds it to the session
// registry, so any step or workbench panel can work with resources created
// elsewhere (Portal, curl, another session).

import { useState } from "react";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useSession } from "@/lib/session";
import { useToast } from "@/lib/toast";
import type { Allowance, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/Button";

type Kind = "token" | "payment-method" | "allowance";

const KIND_CONFIG: Record<
  Kind,
  { placeholder: string; prefix: string; label: string }
> = {
  token: { placeholder: "Basis Theory token id (UUID)", prefix: "", label: "token" },
  "payment-method": { placeholder: "pm_…", prefix: "pm_", label: "payment method" },
  allowance: { placeholder: "alw_…", prefix: "alw_", label: "allowance" },
};

export function ImportPanel({
  kind,
  onImported,
}: {
  kind: Kind;
  onImported?: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();
  const config = KIND_CONFIG[kind];

  const submit = async () => {
    const id = value.trim();
    setError(null);
    if (!id) return;
    if (config.prefix && !id.startsWith(config.prefix)) {
      setError(`That doesn't look like a ${config.label} id (expected ${config.prefix}…).`);
      return;
    }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
      setError("Ids are short alphanumeric strings — check for stray characters.");
      return;
    }
    setLoading(true);
    try {
      if (kind === "token") {
        // Tokens live in the vault; the agentic API has no token read. Register
        // the id as-is — payment-method creation will validate it for real.
        dispatch({
          type: "addToken",
          token: { id, via: "imported", createdAt: Date.now() },
        });
      } else if (kind === "payment-method") {
        const resource = await callAgentic<PaymentMethod>(
          { method: "GET", path: `/payment-methods/${id}`, auth: "proxy" },
          logger,
        );
        dispatch({ type: "upsertPaymentMethod", entry: { resource, imported: true } });
      } else {
        const resource = await callAgentic<Allowance>(
          { method: "GET", path: `/allowances/${id}`, auth: "public" },
          logger,
        );
        dispatch({ type: "upsertAllowance", entry: { resource, imported: true } });
      }
      toast.success(`Imported ${config.label}`, { label: id, value: id });
      setValue("");
      onImported?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder}
          spellCheck={false}
          aria-label={`Import ${config.label} id`}
          className="min-w-0 flex-1 border border-ink-300 bg-white px-2 py-1.5 font-mono text-xs text-ink-900 focus:border-ink-900 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Button variant="ghost" small onClick={submit} loading={loading} loadingLabel="Importing…">
          Import
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
