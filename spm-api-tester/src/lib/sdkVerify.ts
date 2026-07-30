// The SDK flow's integration surface. The snippet below is what a customer
// ships; createVerifier() is the same code parameterized for this app (plus
// the inspector hook). A unit test keeps the two aligned — if you change one,
// change both.

import { AgenticVerification, ApiError as WebAgenticApiError } from "@basis-theory/web-agentic";
import { AGENTIC_API_URL, PUBLIC_KEY } from "@/lib/env";
import type { ApiProblem } from "@/lib/types";

export function createVerifier(options: {
  displayName: string;
  onEvent?: (event: Record<string, unknown>) => void;
}) {
  return AgenticVerification({
    apiKey: PUBLIC_KEY,
    apiBaseUrl: AGENTIC_API_URL,
    displayName: options.displayName,
    onEvent: options.onEvent,
  });
}

export interface NormalizedSdkError {
  message: string;
  name: string;
  problem?: ApiProblem;
  status?: number;
  traceId?: string;
}

/**
 * Preserve the SDK's typed API diagnostics in both the inspector and toast.
 * VerificationNotSupportedError wraps its ApiError as `apiError`, so unwrap
 * that cause as well.
 */
export function normalizeSdkError(error: unknown): NormalizedSdkError {
  const wrapped =
    error && typeof error === "object" && "apiError" in error
      ? (error as { apiError?: unknown }).apiError
      : undefined;
  const apiError =
    error instanceof WebAgenticApiError
      ? error
      : wrapped instanceof WebAgenticApiError
        ? wrapped
        : null;
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";

  if (!apiError) return { message, name };

  return {
    message,
    name,
    status: apiError.status,
    traceId: apiError.traceId,
    problem: {
      type: apiError.type,
      title: apiError.title,
      status: apiError.status,
      detail: apiError.detail,
      errors: apiError.errors,
      debug: apiError.debug,
    },
  };
}

export function serializeSdkEvent(event: Record<string, unknown>): Record<string, unknown> {
  if (!(event.error instanceof Error)) return event;
  return { ...event, error: normalizeSdkError(event.error) };
}

export const SDK_INTEGRATION_SNIPPET = `import { AgenticVerification } from '@basis-theory/web-agentic';

const av = AgenticVerification({
  apiKey: NEXT_PUBLIC_BT_API_KEY,          // public key: agentic:allowance:verify
  apiBaseUrl: '${AGENTIC_API_URL}',
  displayName: 'Your App',
});
const provider = allowance.rails.find(
  (rail) => rail.rail === 'agentic-token',
)?.provider;
if (provider !== 'vic' && provider !== 'agentpay') {
  throw new Error('Allowance has no supported verification provider');
} // never infer this from card brand
const result = await av.verifyAllowance(allowanceId, { provider });
// result: { status: 'active', rail: 'agentic-token', provider: 'vic' | 'agentpay' }`;
