# SPM API Tester

An interactive reference implementation of the Basis Theory **Shared Payment
Model (SPM)**:

```text
card token → payment method → allowance → verification → credentials
```

Tester-owned Manual API calls are visible and copyable, and their writes are
editable. Elements activity and SDK lifecycle events are logged in sanitized
form. Two modes (a guided five-step flow and a freeform workbench), two
verification variants (raw API or the `@basis-theory/web-agentic` SDK), and
full coverage of the mock test-card scenarios.

## Architecture

```text
                        ┌────────────────────────────────────────────┐
                        │                 Browser                    │
                        │                                            │
   Elements (iframe) ◄──┤ tokenize card            public key        │
                        │ POST /payment-methods (+ rails/retry)       │
                        │                           public key ───────┼──► Basis Theory
                        │ POST /allowances/:id/verify (all actions)  │    Agentic API
                        │                                            │
                        │ everything else ──► Next.js proxy          │
                        └──────────────────────────┬─────────────────┘
                                                   │  private key (never in the browser)
                                     /api/agentic/[...path]
                                                   │
                                                   ▼
                          resource reads, allowance create / PATCH / DELETE /
                          rails retry, credential mint / list / get, /errors
```

- **Public key** (browser): card tokenization, payment-method create/retry,
  and every allowance verify action. This is the same key model the SDK and
  Elements use — public application keys are browser-safe by design.
- **Private key** (server only): resource reads, allowance management, and
  credential minting go through the Next.js route handler, which attaches the
  key server-side and summarizes the real upstream exchange into a base64
  `X-BT-Trace` response header for the inspector. **`X-BT-Trace` is a demo
  affordance — do not ship it in a production integration.**

## Setup

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local
# set both keys (test tenant recommended), then:
npm run dev
```

You need **two** Basis Theory applications:

| Key | Env var | Required permissions |
| --- | --- | --- |
| Public | `NEXT_PUBLIC_BT_API_KEY` | `token:create`, `agentic:payment-method:create`, `agentic:allowance:verify` |
| Private | `BT_API_KEY` | `agentic:payment-method:get`, `agentic:payment-method:delete`, `agentic:allowance:create`, `agentic:allowance:get`, `agentic:allowance:update`, `agentic:allowance:delete`, `agentic:credential:create`, `agentic:credential:get` |

Environment variables (see `.env.example` for full comments):

| Var | Purpose |
| --- | --- |
| `BT_API_KEY` | Private key — server-side proxy only |
| `NEXT_PUBLIC_BT_API_KEY` | Public key — browser calls |
| `BT_AGENTIC_API_URL` / `NEXT_PUBLIC_BT_AGENTIC_API_URL` | Agentic API base, server / browser. Deployed test: `https://api.test.basistheory.com/agentic` |
| `NEXT_PUBLIC_BT_VAULT_API_URL` | Vault base for browser tokenization |
| `BT_TENANT_TYPE` | Only exact `test` enables mock defaults and test-only shortcuts; missing/other values fail closed to production behavior |
| `BT_DISPLAY_NAME` | Name the card networks show to cardholders |
| `NEXT_PUBLIC_BT_VISA_ENVIRONMENT` (+ `NEXT_PUBLIC_BT_VISA_SANDBOX_*`) | Optional Visa sandbox override for the Manual variant — no network credentials live in source; the current SDK exposes no equivalent override |

### Local agentic-commerce API

Both projects default to port 3000, so start `agentic-commerce` on 3001 when
running it alongside this tester. Its routes mount under `/api`:

```bash
# in agentic-commerce
PORT=3001 npm run dev
```

```dotenv
# in this tester's .env.local
BT_AGENTIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_BT_AGENTIC_API_URL=http://localhost:3001/api
```

## Running

- `npm run dev` — <http://localhost:3000>
- `npm run dev:tunnel` — dev server plus a Cloudflare HTTPS tunnel
  (`cloudflared` must be installed). Real Visa passkey ceremonies require an
  HTTPS top-level origin **registered with Visa**; mock ceremonies work on
  plain localhost.

  > ⚠️ **The tunnel exposes the private-key proxy.** `/api/agentic/*` has no
  > authentication of its own — anyone who learns the tunnel URL can mint
  > credentials and manage allowances with your private key while the tunnel
  > is up. Use a test tenant, keep the URL to yourself, and stop the tunnel
  > when you're done. This app is a developer tool, not something to deploy.
- `npm run check` — build + lint + tests.

## Modes & flow variants

- **Guided Flow** (`/flow`) — the five steps in order. Step and resource ids
  live in the URL (`?step=verify&pm=…&alw=…`), so every state is deep-linkable
  and browser back/forward works. Any step renders safely with missing state —
  you can import a pasted id instead.
- **Workbench** (`/workbench`) — freeform, resource-oriented: unlimited
  creates with an opt-in idempotency header (when enabled, a fresh key is
  generated after each successful create with a one-click replay of the
  previous key), allowance PATCH / cancel / rails retry, provider-error
  viewers, per-credential metadata reads, and paste-an-id import for external
  resources.
- **Manual vs SDK** — a persistent toggle. Manual walks every verify action as
  an editable JSON request, with the `submit_session` and `submit_passkey`
  bodies pre-filled from real ceremony results. SDK collapses
  the same verification into one `verifyAllowance(id, { provider })` call with
  the SDK's own UI. The provider comes from the allowance rail and is never
  inferred from card brand. Both variants operate on the same allowances.
  Compare the Manual wire timeline with the SDK's lifecycle events and typed
  failures in the inspector; the SDK owns its internal HTTP transport.

## Test scenarios

All from `src/lib/scenarios.ts` — the picker and step reminder chips render
from it, while exact-output tests keep the two checked-in Markdown blocks
below byte-for-byte aligned with the module.

<!-- scenario-catalog:start -->
| PAN | Brand | Scenario (manifests at) | Stable error code |
| --- | --- | --- | --- |
| `4242 4242 4242 4242` | Visa | Visa verification succeeds: OTP, REGISTER passkey, restart, AUTHENTICATE passkey. (Verify) | — |
| `4929 9803 9556 7582` | Visa | Every submit_otp attempt fails with 400 INVALID_OTP. (Verify) | `INVALID_OTP` |
| `5555 5555 5555 4444` | Mastercard | Mastercard verification succeeds: hosted ceremony, then complete. (Verify) | — |
| `5186 1600 0000 0001` | Mastercard | Mastercard rejects the agentic-token rail at creation (CARD_REJECTED); the spt rail stays usable. (Payment Method) | `CARD_REJECTED` |
| `5186 1600 0000 0003` | Mastercard | The Mastercard ceremony runs, but the complete action fails with 422. (Verify) | `PROVIDER_VERIFICATION_FAILED` |
| `4000 0000 0000 0002` | Visa | Stripe rejects the spt rail at creation (CARD_REJECTED); retrying keeps failing. (Payment Method) | `CARD_REJECTED` |
| `4000 0000 0000 0119` | Visa | The spt rail fails on create (PROVIDER_ENROLLMENT_FAILED); a rails retry enables it. (Payment Method) | `PROVIDER_ENROLLMENT_FAILED` |
| `4000 0000 0000 0341` | Visa | spt credential mint fails with 422 PROVIDER_CREDENTIALS_FAILED; the spend reservation is released. (Credentials) | `PROVIDER_CREDENTIALS_FAILED` |
| `4000 0000 0000 9995` | Visa | spt credential mint ends in an unknown provider outcome (409); the reservation is burned to amount_spent. (Credentials) | `CREDENTIAL_OUTCOME_UNKNOWN` |
<!-- scenario-catalog:end -->

Any other Visa or Mastercard PAN follows that brand's happy path.

**Not simulatable with test cards** (the mocks cannot produce these — don't
spend an afternoon trying):

<!-- not-simulatable:start -->
- MAX_ATTEMPTS_EXCEEDED — the mock accepts unlimited OTP attempts
- PASSKEY_FAILED — the mock passkey ceremony always succeeds
- Mastercard PENDING on complete — the mock resolves immediately (real Mastercard can return pending; the bounded poll ships anyway)
- An `error` allowance rail — allowance rails/retry cannot be demonstrated
- NO_ACTIVE_RAILS — mock allowances always provision at least one rail
- Visa enrollment failure at payment-method creation
<!-- not-simulatable:end -->

Beyond PANs, the UI exposes: the test-tenant ceremony shortcut
(`submit_passkey` with a stub body), Mastercard `complete` without the
callback, device-binding restart (REGISTER → restart → AUTHENTICATE, no OTP),
idempotency replays (same key + same body → 409
`CREDENTIAL_PAYLOAD_UNAVAILABLE`; same key + edited body → 409
`IDEMPOTENCY_CONFLICT`), amount overdraw, currency mismatch, and two MPP
field-validation failures.

### Unknown outcomes and reconciliation

`CREDENTIAL_OUTCOME_UNKNOWN` is terminal: the attempted amount is committed to
`amount_spent`, and no spendable payload can be recovered. Resending the
original `BT-IDEMPOTENCY-KEY` deterministically replays the same terminal error;
it cannot recover or re-mint. The API has no credential reconcile or release
endpoint. Sending a new key is a distinct mint attempt and can spend again; it
does not reconcile the first one.

## The inspector

Tester-owned browser and server calls land in the slide-in inspector with a
source pill, method/path, verify-action tag, status, duration, expandable
request/response, `bt-trace-id`, and copy-as-curl (key redacted as
`$BT_API_KEY`). Elements rows are sanitized operation summaries; SDK rows are
lifecycle events and typed failures, not reconstructed internal wire
transcripts. Server rows are hydrated from the proxy's `X-BT-Trace` header —
again: a demo affordance, not something to ship.

## Project layout

```text
src/app/page.tsx                  Landing: mode cards + variant toggle + env summary
src/app/flow/page.tsx             Guided wizard (URL-addressable steps)
src/app/workbench/page.tsx        Freeform resource workbench
src/app/api/config/route.ts       Non-secret runtime config
src/app/api/agentic/[...path]/    Private-key proxy (+ X-BT-Trace, bt-trace-id forwarding)
src/lib/proxy.ts                  The proxy implementation
src/lib/agenticClient.ts          Browser API client: key selection, RFC 7807, curl
src/lib/scenarios.ts              THE test-card catalog (single source of truth)
src/lib/visaCeremony.ts           Visa hidden-iframe/popup protocol (typed port)
src/lib/mastercardCeremony.ts     MC popup + origin-checked bridge + bounded complete poll
src/lib/deviceContext.ts          device_context collector (stable device id, fresh reference id)
src/lib/session.tsx               Session resource registry (sessionStorage-backed)
src/lib/apiLog.tsx                Inspector log store
src/lib/sdkVerify.ts              SDK flow integration + the displayed snippet
src/components/VerifyPanel.tsx    Manual + SDK verification surfaces
src/components/MintPanel.tsx      Credential minting + error demos + reveal cards
src/components/CardTokenizePanel  Elements card collection (mock prefill + real cards)
src/components/Inspector.tsx      The API activity panel
src/components/ui/*               Hand-rolled primitives (toasts live in src/lib/toast.tsx)
src/components/*                  AppShell, Providers, SetupScreen, RequestPanel, ImportPanel,
                                  PaymentMethodCard, CredentialRevealCard, ScenarioChip
src/lib/*                         env, config, types, variant, snippets, mpp, toast
src/lib/*.test.ts                 The vitest suite
```

## Troubleshooting

- **Setup screen on boot** — one of the two keys is missing from `.env.local`.
- **Visa iframe timeout (15s)** — on real Visa environments this almost always
  means the page origin is not registered with Visa. Mock ceremonies don't
  need registration.
- **Popup blocked** — allow popups; ceremonies must open from a click.
- **409 `ALLOWANCE_VERIFICATION_IN_PROGRESS`** — verify calls are serialized
  per allowance; wait a moment and retry (server leases expire).
- **409 `CREDENTIAL_PAYLOAD_UNAVAILABLE` on a successful mint replay** — the
  payload was already returned and cannot be replayed. A new key is a distinct
  mint that can spend again; it never recovers the old payload. Conclusive
  failures release their reservation, while `CREDENTIAL_OUTCOME_UNKNOWN`
  commits spend and must not be retried as recovery.
- **Local API 404s** — start `agentic-commerce` with `PORT=3001`, then remember
  the `/api` suffix on `http://localhost:3001/api`.
