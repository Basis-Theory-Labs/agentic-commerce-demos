// The SDK flow's integration surface. The snippet below is what a customer
// ships; createVerifier() is the same code parameterized for this app (plus
// the inspector hook). A unit test keeps the two aligned — if you change one,
// change both.

import { AgenticVerification } from "@basis-theory/web-agentic";
import { AGENTIC_API_URL, PUBLIC_KEY } from "@/lib/env";

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

export const SDK_INTEGRATION_SNIPPET = `import { AgenticVerification } from '@basis-theory/web-agentic';

const av = AgenticVerification({
  apiKey: NEXT_PUBLIC_BT_API_KEY,          // public key: agentic:allowance:verify + :get
  apiBaseUrl: '${AGENTIC_API_URL}',
  displayName: 'Your App',
});
const result = await av.verifyAllowance(allowanceId);  // renders its own UI
// result: { status: 'active', rail: 'agentic-token', provider: 'vic' | 'agentpay' }`;
