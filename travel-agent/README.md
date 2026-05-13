# SkyAgent — Travel-Agent Demo

A Basis Theory **agentic commerce** demo built as if Skyscanner shipped an
AI booking assistant. The user chats their travel intent, the agent surfaces
flights, and a single-use virtual card is issued and "spent" on a simulated
airline checkout — end to end with real Basis Theory APIs.

Every call the app makes (Next.js API routes, upstream Basis Theory calls,
Elements tokenization, react-agentic SDK verification) is rendered live in a
hideable **Behind the calls** panel — useful both for the demo and as a code
example for engineers integrating the same flow.

## What's exercised

1. **`POST /tokens`** via Elements — tokenize a card in a secure iframe.
2. **`POST /agentic/agents`** — create an AI agent.
3. **`POST /agentic/enrollments`** — enroll the card with the network.
4. **`useAgentic().verifyEnrollment()`** — OTP + passkey (Visa) or popup
   (Mastercard) via the **react-agentic** SDK.
5. **`POST /agentic/agents/{id}/instructions`** — create a single-use payment
   instruction scoped to the airline and amount.
6. **`useAgentic().verifyInstruction()`** — passkey authentication.
7. **`POST /agentic/agents/{id}/instructions/{id}/credentials`** — fetch a
   time-limited virtual card (PAN + expiry + CVC).
8. The agent "uses" the card on a simulated airline checkout.
9. **`POST /agentic/agents/{id}/instructions/{id}/confirmations`** — report
   the transaction result back to the network so it can settle.

The saved-card path skips steps 1–4 and reuses an existing verified
enrollment.

## Prerequisites

- Node.js 20+
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  — only needed for full verification flows (the card-network SDKs require
  HTTPS; passkeys + popups will refuse to run on plain `http://`)
- A Basis Theory account with agentic commerce enabled, and two keys for the
  same environment (test or production):
  - **Private** key — server side only
  - **Public** key — client side (Elements + react-agentic)

## Setup

```bash
cd travel-agent
npm install
cp .env.example .env.local
# fill in BT_API_KEY / NEXT_PUBLIC_BT_API_KEY
```

`.env.example`:

```env
BT_API_KEY=key_priv_...
NEXT_PUBLIC_BT_API_KEY=key_pub_...
BT_ENVIRONMENT=test          # or "production"
NEXT_PUBLIC_BT_ENVIRONMENT=test
```

Production keys hit `api.basistheory.com`; test keys hit
`api.test.basistheory.com`. The `NEXT_PUBLIC_BT_ENVIRONMENT` value is shown
as a tag in the header.

## Running

```bash
# HTTP-only — fine until you reach the verification step
npm run dev

# HTTPS via Cloudflare quick tunnel — required for verification
npm run dev:tunnel
# Open the printed https://*.trycloudflare.com URL
```

The full booking flow (new card → enrollment → verification → instruction →
verification → credentials → airline checkout) requires HTTPS because the
Visa / Mastercard SDKs invoked by `verifyEnrollment` and `verifyInstruction`
will not run otherwise.

## Project layout

```
travel-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx              # The whole demo flow lives here.
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── agents/route.ts
│   │       ├── enrollments/route.ts
│   │       ├── instructions/route.ts
│   │       ├── credentials/route.ts
│   │       └── confirmations/route.ts
│   ├── components/
│   │   ├── Providers.tsx         # Elements + react-agentic + ApiLogProvider
│   │   ├── Header.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── SearchInput.tsx
│   │   ├── FlightResults.tsx
│   │   ├── PaymentChoice.tsx
│   │   ├── TokenizeCard.tsx      # Elements iframe + bt.tokens.create()
│   │   ├── EnrollmentPicker.tsx
│   │   ├── StepStatus.tsx
│   │   ├── AirlineCheckout.tsx   # Simulated merchant page that "uses" the credential
│   │   └── BehindTheCallsPanel.tsx
│   └── lib/
│       ├── api.ts                # btProxy() + withTrace() helpers
│       ├── apiLog.tsx            # ApiLogProvider + useLoggedFetch()
│       ├── flights.ts            # Mock flight data + tiny NL parser
│       └── types.ts
├── package.json
├── next.config.ts
└── tsconfig.json
```

## How the "Behind the calls" panel works

The panel is intentionally simple so you can copy the pattern:

1. **Client-side fetches** go through `useLoggedFetch()` from
   `src/lib/apiLog.tsx`. The wrapper records the local API-route call.
2. **Server-side proxies** in `src/app/api/*` use `btProxy()` in
   `src/lib/api.ts`, which captures the upstream URL / method / body /
   status / response and serializes it into a base64-encoded `X-BT-Trace`
   response header.
3. The client wrapper decodes that header and pushes a second entry
   ("Server → Basis Theory") so you see both hops without exposing your
   private key.
4. SDK calls (Elements `bt.tokens.create`, react-agentic `verifyEnrollment`
   / `verifyInstruction`) are logged manually from the components that call
   them.

## Test cards

| Brand      | Number               |
|------------|----------------------|
| Visa       | `4242 4242 4242 4242` |
| Mastercard | `5200 0000 0000 1005` |

## License

MIT
