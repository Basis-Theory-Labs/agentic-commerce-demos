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
  /** Show an editable Idempotency-Key field with a regenerate button. */
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
  // After a successful send the key regenerates (fresh key per create) and
  // the used key is kept so "Replay last key" can demonstrate server-side
  // replay semantics on purpose.
  const [lastSentKey, setLastSentKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
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
    setProblem(null);
    let parsed: unknown;
    try {
      parsed = body.trim() ? JSON.parse(body) : undefined;
    } catch {
      setProblem({ title: "Request body is not valid JSON" });
      return;
    }
    setSending(true);
    onSendStateChange?.(true);
    const usedKey = idemKey.trim();
    try {
      const result = await callAgentic(
        {
          method,
          path,
          body: parsed,
          auth,
          tag,
          idempotencyKey: idempotency ? usedKey : undefined,
        },
        logger,
      );
      if (idempotency) {
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
      setSending(false);
      onSendStateChange?.(false);
    }
  };

  return (
    <div className="border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2">
        <span
          className={`px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
            method === "GET"
              ? "bg-ink-200 text-ink-800"
              : method === "DELETE"
                ? "bg-error text-white"
                : "bg-ink-900 text-white"
          }`}
        >
          {method}
        </span>
        <span className="min-w-0 flex-1 font-mono text-xs break-all text-ink-900">{path}</span>
        <span
          className={`border px-1.5 py-0.5 text-[10px] uppercase ${
            auth === "public"
              ? "border-ink-300 bg-white text-ink-600"
              : "border-ink-900 bg-ink-900 text-white"
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
        {idempotency && (
          <div>
            <label className="mb-1 block text-[11px] tracking-wide text-ink-500 uppercase">
              Idempotency-Key
            </label>
            <div className="flex gap-1.5">
              <input
                value={idemKey}
                onChange={(e) => setIdemKey(e.target.value)}
                spellCheck={false}
                className="min-w-0 flex-1 border border-ink-300 bg-white px-2 py-1.5 font-mono text-xs text-ink-900 focus:border-ink-900 focus:outline-none"
              />
              <Button variant="ghost" small onClick={() => setIdemKey(crypto.randomUUID())}>
                Regenerate
              </Button>
              {lastSentKey && (
                <Button
                  variant="ghost"
                  small
                  onClick={() => setIdemKey(lastSentKey)}
                  title="Restore the key from the last successful send — resending then demonstrates the server's replay behavior"
                >
                  Replay last key
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-500">
              A fresh key is generated after each successful send.{" "}
              {idempotencyNote ??
                "Use Replay last key to resend with the previous key on purpose — same body replays, edited body 409s with IDEMPOTENCY_CONFLICT."}
            </p>
          </div>
        )}

        {defaultBody !== undefined && (
          <JsonEditor value={body} onChange={setBody} defaultValue={defaultJson} />
        )}

        {children}

        <div className="flex items-center gap-3">
          <Button onClick={send} loading={sending} loadingLabel={loadingLabel} disabled={disabled}>
            {sendLabel}
          </Button>
        </div>

        {problem && (
          <div
            role="alert"
            className="space-y-1 border border-error-border bg-error-soft px-2.5 py-2 text-xs"
          >
            <div className="font-medium text-error">{problem.title ?? "Request failed"}</div>
            {problem.detail && <div className="text-ink-700">{problem.detail}</div>}
            {problem.errors &&
              Object.entries(problem.errors).map(([field, messages]) => (
                <div key={field} className="text-ink-700">
                  <span className="font-mono">{field}</span>: {messages.join("; ")}
                </div>
              ))}
            {problem.type && <div className="font-mono text-[10px] text-ink-500">{problem.type}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
