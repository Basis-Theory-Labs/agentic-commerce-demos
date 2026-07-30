"use client";

// Editable request panel: METHOD + path + which key the call carries, a JSON
// body you can edit, and a Send button. This is the heart of the tester —
// the requests the docs describe are the requests you actually send.

import { useEffect, useMemo, useRef, useState } from "react";
import { AgenticApiError, callAgentic, type AuthMode } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useToast } from "@/lib/toast";
import { JsonEditor } from "@/components/ui/JsonEditor";
import { Button } from "@/components/ui/Button";
import type { ApiProblem } from "@/lib/types";

export interface RequestPanelProps {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth: AuthMode;
  /** Omit for body-less requests. */
  defaultBody?: unknown;
  /** Let the user opt into an editable BT-IDEMPOTENCY-KEY header. */
  idempotency?: boolean;
  /** Note rendered under the key field (the replay teachable moment). */
  idempotencyNote?: string;
  sendLabel?: string;
  loadingLabel?: string;
  /** Inspector tag (e.g. the verify action). */
  tag?: string;
  /** Toast headline + copyable id extraction on success. */
  successToast?: (result: unknown) => { title: string; id?: string } | null;
  onSuccess?: (result: unknown) => void | Promise<void>;
  onError?: (error: AgenticApiError) => void;
  disabled?: boolean;
  /** Lets a parent serialize this panel with its other in-flight actions. */
  onSendStateChange?: (sending: boolean) => void;
  children?: React.ReactNode;
}

export function RequestPanel({
  method,
  path,
  auth,
  defaultBody,
  idempotency = false,
  idempotencyNote,
  sendLabel = "Send",
  loadingLabel = "Sending…",
  tag,
  successToast,
  onSuccess,
  onError,
  disabled = false,
  onSendStateChange,
  children,
}: RequestPanelProps) {
  const defaultJson = useMemo(
    () => (defaultBody === undefined ? "" : JSON.stringify(defaultBody, null, 2)),
    [defaultBody],
  );
  const [body, setBody] = useState(defaultJson);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [includeIdempotencyKey, setIncludeIdempotencyKey] = useState(false);
  // After a successful send the key regenerates (fresh key per create) and
  // the used key is kept so "Replay last key" can demonstrate server-side
  // replay semantics on purpose.
  const [lastSentKey, setLastSentKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const sendingRef = useRef(false);
  const logger = useApiLog();
  const toast = useToast();

  // When the caller swaps the default body (e.g. a different resource became
  // selected), refresh the editor — but never while the user mid-edits the
  // same default.
  const lastDefault = useRef(defaultJson);
  useEffect(() => {
    if (defaultJson !== lastDefault.current) {
      setBody((current) => (current === lastDefault.current ? defaultJson : current));
      lastDefault.current = defaultJson;
    }
  }, [defaultJson]);

  const send = async () => {
    if (sendingRef.current) return;
    setProblem(null);
    let parsed: unknown;
    try {
      parsed = body.trim() ? JSON.parse(body) : undefined;
    } catch {
      setProblem({ title: "Request body is not valid JSON" });
      return;
    }
    const usedKey = idemKey.trim();
    if (idempotency && includeIdempotencyKey && !usedKey) {
      setProblem({
        title: "BT-IDEMPOTENCY-KEY cannot be empty",
        detail: "Enter a value, regenerate the key, or turn idempotency off for this request.",
      });
      return;
    }
    sendingRef.current = true;
    setSending(true);
    onSendStateChange?.(true);
    try {
      const result = await callAgentic(
        {
          method,
          path,
          body: parsed,
          auth,
          tag,
          idempotencyKey: idempotency && includeIdempotencyKey ? usedKey : undefined,
        },
        logger,
      );
      if (idempotency && includeIdempotencyKey) {
        setLastSentKey(usedKey);
        setIdemKey(crypto.randomUUID());
      }
      const successInfo = successToast?.(result);
      if (successInfo) {
        toast.success(
          successInfo.title,
          successInfo.id ? { label: successInfo.id, value: successInfo.id } : undefined,
        );
      }
      await onSuccess?.(result);
    } catch (error) {
      if (error instanceof AgenticApiError) {
        setProblem(error.problem);
        toast.error(error);
        onError?.(error);
      } else {
        const message = error instanceof Error ? error.message : "Request failed";
        setProblem({ title: message });
        toast.error(error);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      onSendStateChange?.(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-surface-raised px-3 py-2">
        <span
          className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
            method === "GET"
              ? "bg-ink-200 text-ink-800"
              : method === "DELETE"
                ? "bg-error-solid text-white"
                : "bg-accent text-accent-foreground"
          }`}
        >
          {method}
        </span>
        <span className="min-w-0 flex-1 font-mono text-xs break-all text-ink-900">{path}</span>
        {idempotency && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-ink-500">
            Idempotency
            <button
              type="button"
              role="switch"
              aria-checked={includeIdempotencyKey}
              aria-label="Include BT-IDEMPOTENCY-KEY"
              disabled={sending}
              onClick={() => {
                setIncludeIdempotencyKey((included) => !included);
                setProblem(null);
              }}
              className={`relative h-4 w-7 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                includeIdempotencyKey ? "border-accent bg-accent" : "border-ink-300 bg-ink-100"
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-px left-px h-3 w-3 rounded-full transition-transform ${
                  includeIdempotencyKey
                    ? "translate-x-3 bg-accent-foreground"
                    : "translate-x-0 bg-ink-500"
                }`}
              />
            </button>
          </span>
        )}
        <span
          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            auth === "public"
              ? "border-ink-300 bg-surface text-ink-600"
              : "border-accent/30 bg-accent-soft text-accent"
          }`}
          title={
            auth === "public"
              ? "Sent directly from the browser with the public key"
              : "Sent via the Next.js proxy with the private key"
          }
        >
          {auth === "public" ? "browser · public key" : "server · private key"}
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        {idempotency && includeIdempotencyKey && (
          <section className="rounded-lg border border-accent/30 bg-accent-soft/30 p-2.5">
            <label className="mb-1 block text-[10px] font-medium tracking-wide text-ink-500 uppercase">
              BT-IDEMPOTENCY-KEY
            </label>
            <div className="flex flex-wrap gap-1.5">
              <input
                value={idemKey}
                onChange={(e) => setIdemKey(e.target.value)}
                spellCheck={false}
                aria-label="BT-IDEMPOTENCY-KEY value"
                className="min-w-64 flex-1 rounded-lg border border-ink-300 bg-screen/70 px-2.5 py-1.5 font-mono text-xs text-ink-900 focus:border-accent focus:outline-none"
              />
              <Button variant="ghost" small onClick={() => setIdemKey(crypto.randomUUID())}>
                Regenerate
              </Button>
              {lastSentKey && (
                <Button
                  variant="ghost"
                  small
                  onClick={() => setIdemKey(lastSentKey)}
                  title="Restore the key from the last successful send"
                >
                  Replay last key
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-500">
              {idempotencyNote ??
                "A fresh key follows each success. Replay the last key to test idempotent responses."}
            </p>
          </section>
        )}

        {defaultBody !== undefined && (
          <JsonEditor value={body} onChange={setBody} defaultValue={defaultJson} />
        )}

        {children}

        {problem && (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-error-border bg-error-soft px-2.5 py-2 text-xs"
          >
            <div className="font-medium text-error">{problem.title ?? "Request failed"}</div>
            {problem.detail && <div className="text-ink-700">{problem.detail}</div>}
            {problem.instance && (
              <div className="font-mono text-[11px] break-all text-ink-500">{problem.instance}</div>
            )}
            {problem.errors &&
              Object.entries(problem.errors).map(([field, messages]) => (
                <div key={field} className="text-ink-700">
                  <span className="font-mono">{field}</span>: {messages.join("; ")}
                </div>
              ))}
            <div className="flex flex-wrap gap-2 font-mono text-[11px] text-ink-500">
              {problem.status !== undefined && <span>HTTP {problem.status}</span>}
              {problem.type && <span>{problem.type}</span>}
              {problem.debug?.provider_correlation && (
                <span>provider correlation: {problem.debug.provider_correlation}</span>
              )}
            </div>
          </div>
        )}

        <div className="-mx-3 -mb-3 flex items-center gap-2 border-t border-ink-200 bg-ink-50/45 px-3 py-2">
          <Button onClick={send} loading={sending} loadingLabel={loadingLabel} disabled={disabled}>
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
