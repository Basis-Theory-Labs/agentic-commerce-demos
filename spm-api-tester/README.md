# SPM API Tester

An interactive reference implementation of the Basis Theory **Shared Payment
Model (SPM)**:

```text
card token → payment method → allowance → verification → credentials
```

Every wire call is visible, editable, and copyable. Two modes (a guided
five-step flow and a freeform workbench), two verification variants (raw API
or the `@basis-theory/agentic-verification` SDK), and full coverage of the
mock test-card scenarios.

## Architecture

```text
                        ┌────────────────────────────────────────────┐
                        │                 Browser                    │
                        │                                            │
   Elements (iframe) ◄──┤ tokenize card            public key        │
                        │ POST /payment-methods    public key ───────┼──► Basis Theory
                        │ POST /allowances/:id/verify (all actions)  │    Agentic API
                        │ GET  /allowances/:id     public key ───────┼──►
                        │                                            │
                        │ everything else ──► Next.js proxy          │
                        └──────────────────────────┬─────────────────┘
                                                   │  private key (never in the browser)
                                     /api/agentic/[...path]
                                                   │
                                                   ▼
                          allowance create / PATCH / DELETE / rails retry,
                          credential mint / list / get, /errors lists
```

- **Public key** (browser): card tokenization, payment-method creation, every
  verify action, allowance reads. This is the same key model the SDK and
  Elements use — public application keys are browser-safe by design.
- **Private key** (server only): allowance management and credential minting
  go through the Next.js route handler, which attaches the key server-side
  and summarizes the real upstream exchange into a base64 `X-BT-Trace`
  response header for the inspector. **`X-BT-Trace` is a demo affordance — do
  not ship it in a production integration.**

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
| Public | `NEXT_PUBLIC_BT_API_KEY` | `token:create`, `agentic:payment-method:create`, `agentic:allowance:verify`, `agentic:allowance:get` |
| Private | `BT_API_KEY` | `agentic:allowance:*`, `agentic:credential:*`, `agentic:payment-method:*` |

Environment variables (see `.env.example` for full comments):

| Var | Purpose |
| --- | --- |
| `BT_API_KEY` | Private key — server-side proxy only |
| `NEXT_PUBLIC_BT_API_KEY` | Public key — browser calls |
| `BT_AGENTIC_API_URL` / `NEXT_PUBLIC_BT_AGENTIC_API_URL` | Agentic API base, server / browser. Deployed test: `https://api.test.basistheory.com/agentic` |
| `NEXT_PUBLIC_BT_VAULT_API_URL` | Vault base for browser tokenization |
| `BT_TENANT_TYPE` | `test` enables mock cards and test-only shortcuts |
| `BT_DISPLAY_NAME` | Name the card networks show to cardholders |
| `NEXT_PUBLIC_BT_VISA_ENVIRONMENT` (+ `NEXT_PUBLIC_BT_VISA_SANDBOX_*`) | Optional Visa sandbox override — no network credentials live in source |

### Local agentic-commerce API

The locally-run service mounts its routes under `/api` — note the suffix:

```dotenv
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
  creates (fresh idempotency key each time), allowance PATCH / cancel / rails
  retry, provider-error viewers, per-credential metadata reads, and paste-an-id
  import for external resources.
- **Manual vs SDK** — a persistent toggle. Manual walks every verify action as
  an editable JSON request (including the `submit_session`, `submit_passkey`,
  and `complete` bodies pre-filled from real ceremony results). SDK collapses
  the same verification into one `verifyAllowance()` call with the SDK's own
  UI. Both operate on the same allowances — verify one each way and compare
  transcripts in the inspector.

## Test scenarios

All from `src/lib/scenarios.ts` — the picker, the step reminder chips, and
this table render from the same module.

| PAN | Brand | Scenario (manifests at) |
| --- | --- | --- |
| `4242 4242 4242 4242` | Visa | Happy path: OTP → passkey (Verify) |
| `4929 9803 9556 7582` | Visa | Every `submit_otp` → 400 `INVALID_OTP` (Verify) |
| `5555 5555 5555 4444` | Mastercard | Happy path: hosted ceremony → `complete` (Verify) |
| `5186 1600 0000 0001` | Mastercard | agentic-token rail rejected at creation (`CARD_REJECTED`); spt still usable (Payment Method) |
| `5186 1600 0000 0003` | Mastercard | Ceremony runs, `complete` → 422 `PROVIDER_VERIFICATION_FAILED` (Verify) |
| `4000 0000 0000 0002` | Visa | spt rail rejected (`CARD_REJECTED`); retry stays rejected (Payment Method) |
| `4000 0000 0000 0119` | Visa | spt rail errors (`PROVIDER_ENROLLMENT_FAILED`); rails retry succeeds (Payment Method) |
| `4000 0000 0000 0341` | Visa | spt mint → 422 `PROVIDER_CREDENTIALS_FAILED`, reservation released (Credentials) |
| `4000 0000 0000 9995` | Visa | spt mint → 409 `CREDENTIAL_OUTCOME_UNKNOWN`, reservation burned to `amount_spent` (Credentials) |

Any other Visa or Mastercard PAN follows that brand's happy path.

**Not simulatable with test cards** (the mocks cannot produce these — don't
spend an afternoon trying): `MAX_ATTEMPTS_EXCEEDED`, `PASSKEY_FAILED`,
Mastercard `PENDING` on `complete` (the bounded poll ships anyway), an `error`
**allowance** rail (so allowance rails/retry can't be demoed),
`NO_ACTIVE_RAILS`, and Visa enrollment failure.

Beyond PANs, the UI exposes: the test-tenant ceremony shortcut
(`submit_passkey` with a stub body), Mastercard `complete` without the
callback, device-binding restart (REGISTER → restart → AUTHENTICATE, no OTP),
idempotency replays (same key + same body → 409
`CREDENTIAL_PAYLOAD_UNAVAILABLE`; same key + edited body → 409
`IDEMPOTENCY_CONFLICT`), amount overdraw, currency mismatch, and two MPP
field-validation failures.

## The inspector

Every wire call lands in the slide-in inspector: source pill (`browser` /
`server` / `elements` / `sdk` — the key-placement story made visible), method
and path, verify-action tag, status, duration, expandable request/response
with copy buttons, `bt-trace-id`, and copy-as-curl (key redacted as
`$BT_API_KEY`). Server rows are hydrated from the proxy's `X-BT-Trace` header
— again: a demo affordance, not something to ship.

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
```

## Troubleshooting

- **Setup screen on boot** — one of the two keys is missing from `.env.local`.
- **Visa iframe timeout (15s)** — on real Visa environments this almost always
  means the page origin is not registered with Visa. Mock ceremonies don't
  need registration.
- **Popup blocked** — allow popups; ceremonies must open from a click.
- **409 `ALLOWANCE_VERIFICATION_IN_PROGRESS`** — verify calls are serialized
  per allowance; wait a moment and retry (server leases expire).
- **409 on a credential mint replay** — that's the feature: payloads are
  returned exactly once. Regenerate the key to mint again.
- **Local API 404s** — remember the `/api` suffix on `http://localhost:3001/api`.
