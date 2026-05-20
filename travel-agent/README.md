# SkyAgent — Travel-Agent Demo

A Basis Theory **agentic commerce** demo. The user chats their travel
intent, the agent surfaces flights, and a single-use virtual card is
issued and "spent" on a simulated airline checkout — end to end with
real Basis Theory APIs.

Every call the app makes (Next.js API routes, upstream Basis Theory
calls, Elements tokenization, react-agentic SDK verification) is
rendered live in a hideable **Behind the calls** panel — a walk-through
of the flow and a copy-paste reference for wiring the same flow into
your own product.

## What's exercised

The numbered steps are what you'll see fire in the "Behind the calls"
panel as you click through:

1. **`POST /agentic/agents`** — bootstrap a long-lived agent on first
   page load. The agent id is cached in `localStorage` so every
   subsequent booking reuses it.
2. **`POST /tokens`** (via Elements) — tokenize the card in a secure
   iframe. The card number never enters the demo's DOM.
3. **`POST /agentic/enrollments`** — enroll the tokenized card with the
   network and link it to the agent.
4. **`useAgentic().verifyEnrollment()`** — passkey verification via the
   **react-agentic** SDK.
5. **`POST /agentic/agents/{id}/instructions`** — create a single-use
   payment instruction scoped to the airline and amount.
6. **`useAgentic().verifyInstruction()`** — passkey verification for the
   specific spend.
7. **`POST /agentic/agents/{id}/instructions/{id}/credentials`** — fetch
   a time-limited virtual card (PAN + expiry + CVC).
8. The agent "uses" the card on a simulated airline checkout.

The **saved-card** path skips steps 2–4 and reuses an existing verified
enrollment.

## Prerequisites

- **Node.js 20+**
- A **Basis Theory account** with agentic commerce enabled, plus two
  keys for the same environment:
  - `BT_API_KEY` — private key, server-side only
  - `NEXT_PUBLIC_BT_API_KEY` — public key, used by Elements and
    react-agentic
- An HTTPS tunnel for the verification steps. Passkeys won't run on
  `http://`, so they need an HTTPS URL. The `npm run dev:tunnel` script
  spins up a free quick tunnel for you.

## Setup

```bash
cd travel-agent
npm install
cp .env.example .env.local
# fill in BT_API_KEY / NEXT_PUBLIC_BT_API_KEY
```

### Environment variables

| Variable | Where it's read | Default | Purpose |
|---|---|---|---|
| `BT_API_KEY` | server (`src/lib/api.ts`) | — | Private key used by the Next.js API routes |
| `NEXT_PUBLIC_BT_API_KEY` | client (`src/components/Providers.tsx`) | — | Public key passed to Elements + react-agentic |
| `BT_ENVIRONMENT` | server | `test` | `test` or `production` |
| `NEXT_PUBLIC_BT_ENVIRONMENT` | client | `test` | Same values; shown as a tag in the panel |

`test` resolves to `https://api.test.basistheory.com` and `production` to
`https://api.basistheory.com`. The keys you pass must belong to the same
environment.

## Running

```bash
# HTTP-only — fine until you reach the verification step
npm run dev

# HTTPS via a quick tunnel — required for verification
npm run dev:tunnel
# Open the printed https://... URL
```

The full booking flow (new card → enrollment → verification →
instruction → verification → credentials → airline checkout) requires
HTTPS because the card-network SDKs invoked by `verifyEnrollment` and
`verifyInstruction` will not run otherwise. The panel surfaces an error
banner if the SDK fails to load.

## Test cards

| Brand      | Number                |
|------------|-----------------------|
| Visa       | `4242 4242 4242 4242` |
| Mastercard | `5200 0000 0000 1005` |

Use any future expiry and any 3-digit CVC.

## Customizing the API request bodies

Every Basis Theory call goes through a thin Next.js API route that
forwards the JSON body to `btProxy()` (`src/lib/api.ts`) — to change a
request body, edit the call-site in the component, not the route.

| Call | Body constructed in |
|---|---|
| `POST /agentic/agents` | `src/components/AgentProvider.tsx` |
| `POST /agentic/enrollments` | `src/app/page.tsx` (`provisionNewCard`) |
| `POST /agentic/agents/{id}/instructions` | `src/app/page.tsx` (`handleAuthorize`) |
| `POST /agentic/agents/{id}/instructions/{id}/credentials` | `src/app/page.tsx` (`handleAuthorize`) |

Common tweaks:

- **Rename the wallet.** The `WALLET_NAME = "SkyAgent"` constant lives
  in `src/app/api/enrollments/route.ts` (filters list results),
  `src/components/EnrollmentPicker.tsx` (filters in the UI), and
  `src/app/page.tsx` (sent as `wallet_name` at enrollment time). Keep
  them aligned.
- **Use a real merchant.** The `merchant` block in `handleAuthorize` is
  built from the selected flight's `bookingUrl`. Swap the data in
  `src/lib/flights.ts` to drive different merchants.
- **Change the instruction window.** `expires_at` is set to "now + 1h".
  Adjust as needed.

The flight data and query parser are entirely client-side
(`src/lib/flights.ts`). The preset query at the top of
`src/app/page.tsx` (`PRESET_QUERY`) seeds the conversation — swap it or
wire up an input if you want free-form text.

## How the "Behind the calls" panel works

1. **Client-side fetches** go through `useLoggedFetch()` from
   `src/lib/apiLog.tsx`. The wrapper records the call.
2. **Server-side proxies** in `src/app/api/*` use `btProxy()` from
   `src/lib/api.ts`, which captures the upstream URL / method / body /
   status / response and serializes it into a base64-encoded
   `X-BT-Trace` response header.
3. The client wrapper decodes that header and pushes a second entry
   ("Server → Basis Theory") so you see both hops without exposing the
   private key.
4. SDK calls (Elements `bt.tokens.create`, react-agentic
   `verifyEnrollment` / `verifyInstruction`) are logged from the
   components that invoke them.

The `X-BT-Trace` header is a demo affordance and should not ship in
production.

## Project layout

```
travel-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Whole demo flow
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── agents/route.ts          # POST /agentic/agents
│   │       ├── enrollments/route.ts     # POST + GET /agentic/enrollments
│   │       ├── instructions/route.ts    # POST /agentic/agents/{id}/instructions
│   │       └── credentials/route.ts     # POST .../instructions/{id}/credentials
│   ├── components/
│   │   ├── Providers.tsx           # Elements + react-agentic + ApiLog
│   │   ├── AgentProvider.tsx       # Bootstraps + persists the agent id
│   │   ├── Header.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── FlightResults.tsx
│   │   ├── PaymentChoice.tsx
│   │   ├── TokenizeCard.tsx        # Elements iframe + bt.tokens.create()
│   │   ├── EnrollmentPicker.tsx    # Saved-card chooser
│   │   ├── AirlineCheckout.tsx     # Simulated merchant checkout
│   │   ├── BookingReceipt.tsx      # Trip summary
│   │   ├── BrandLogo.tsx
│   │   └── BehindTheCallsPanel.tsx
│   └── lib/
│       ├── api.ts                  # btProxy() + withTrace() helpers
│       ├── apiLog.tsx              # ApiLogProvider + useLoggedFetch()
│       ├── flights.ts              # Flight data + query parser
│       └── types.ts                # Agentic-commerce types
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Troubleshooting

- **"Verify card" stays disabled / SDK never loads.** The react-agentic
  SDK won't initialize on `http://`. Use `npm run dev:tunnel` and open
  the printed `https://` URL. Disable ad-blockers — they tend to block
  the card-network SDKs.
- **"BT_API_KEY environment variable is not set"** in the server logs.
  `.env.local` is missing or unreadable — `cp .env.example .env.local`,
  fill in the keys, then restart `next dev`.
- **The saved-card picker is empty even though you just saved a card.**
  The picker filters by `wallet_name === "SkyAgent"`. If you renamed
  the wallet in one place but not the other, the filter and the body
  fall out of sync. Keep them aligned.
- **Verification popup closes itself immediately.** Browser pop-up
  blockers. Allow popups for your tunnel domain.
- **`Tokenization returned no id`.** Public key mismatch between
  Elements (client) and the Basis Theory environment. Double-check
  `NEXT_PUBLIC_BT_API_KEY` and `NEXT_PUBLIC_BT_ENVIRONMENT` — both must
  point at the same tenant.

## License

[MIT](../LICENSE)
