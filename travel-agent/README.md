# SkyAgent — Travel-Agent Demo

A Basis Theory **agentic commerce** demo built as if Skyscanner shipped an
AI booking assistant. The user chats their travel intent, the agent
surfaces flights, and a single-use virtual card is issued and "spent" on
a simulated airline checkout — end to end with real Basis Theory APIs.

Every call the app makes (Next.js API routes, upstream Basis Theory
calls, Elements tokenization, react-agentic SDK verification) is
rendered live in a hideable **Behind the calls** panel — useful both as
a demo prop and as a copy-paste reference for engineers wiring the same
flow into their own product.

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
4. **`useAgentic().verifyEnrollment()`** — passkey (Visa) or popup
   (Mastercard) verification via the **react-agentic** SDK.
5. **`POST /agentic/agents/{id}/instructions`** — create a single-use
   payment instruction scoped to the airline and amount.
6. **`useAgentic().verifyInstruction()`** — passkey re-authentication for
   the specific spend.
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
  - `NEXT_PUBLIC_BT_API_KEY` — public key, used by Elements and react-agentic
- **[`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)**
  — only needed for the verification steps. Passkeys and the Mastercard
  popup refuse to run on `http://`, so they need an HTTPS URL. The
  `npm run dev:tunnel` script spins up a free Cloudflare quick tunnel
  for you.

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
| `BT_ENVIRONMENT` | server | `test` | `production` / `test` / `local` |
| `NEXT_PUBLIC_BT_ENVIRONMENT` | client | `test` | Same values; shown as a tag in the panel |
| `BT_LOCAL_API_URL` | server (only when env is `local`) | `http://localhost:3001` | Override the local BT base URL |
| `NEXT_PUBLIC_BT_LOCAL_API_URL` | client (only when env is `local`) | `http://localhost:3001` | Same, for the SDK |

The `production` and `test` values resolve to `https://api.basistheory.com`
and `https://api.test.basistheory.com` respectively. Use `local` if you
want to point the demo at a Basis Theory–compatible API running on your
own machine — handy when you're hacking on the API itself. Both server
and client append `/agentic/...` to whatever base URL the environment
resolves to.

## Running

```bash
# HTTP-only — fine until you reach the verification step
npm run dev

# HTTPS via Cloudflare quick tunnel — required for verification
npm run dev:tunnel
# Open the printed https://*.trycloudflare.com URL
```

The full booking flow (new card → enrollment → verification →
instruction → verification → credentials → airline checkout) requires
HTTPS because the Visa / Mastercard SDKs invoked by
`verifyEnrollment` and `verifyInstruction` will not run otherwise. The
panel will surface a friendly error banner if the SDK fails to load.

## Test cards

| Brand      | Number                | Verification |
|------------|-----------------------|--------------|
| Visa       | `4242 4242 4242 4242` | Passkey (your device prompts) |
| Mastercard | `5200 0000 0000 1005` | Popup window |

Use any future expiry and any 3-digit CVC.

## Customizing the API request bodies

Every BT call goes through a thin Next.js API route that just forwards
the JSON body to `btProxy()` (`src/lib/api.ts`) — so to change a request
body you edit the call-site in the component, not the route.

| Call | Body constructed in | Snippet |
|---|---|---|
| `POST /agentic/agents` | `src/components/AgentProvider.tsx` | `{ name: "SkyAgent" }` |
| `POST /agentic/enrollments` | `src/app/page.tsx` (`provisionNewCard`) | `{ token_id, agent_id, wallet_name, consumer: { email } }` |
| `POST /agentic/agents/{id}/instructions` | `src/app/page.tsx` (`handleAuthorize`) | `{ enrollment_id, amount, description, expires_at, merchant }` |
| `POST /agentic/agents/{id}/instructions/{id}/credentials` | `src/app/page.tsx` (`handleAuthorize`) | `{ amount, merchant, delivery_method }` |

Common tweaks:

- **Rename the wallet.** Change the `WALLET_NAME = "SkyAgent"` constants
  in `src/app/api/enrollments/route.ts` (filters list results) and
  `src/components/EnrollmentPicker.tsx` (filters in the UI). The same
  string is sent as `wallet_name` in the enrollment body in
  `src/app/page.tsx`.
- **Use a real merchant.** The `merchant` block in `handleAuthorize`
  is built from the selected flight's `bookingUrl`. Swap the
  `flights.ts` data — or pull from a real flight API — to drive
  different merchants.
- **Change the instruction window.** `expires_at` is set to "now + 1h".
  Tighten or loosen as needed.
- **Add a category code.** The `merchant` object accepts an optional
  `category_code` (see `src/lib/types.ts`). Pass it in if you need MCC
  routing on your tenant.

The mock flight data and natural-language parser are entirely
client-side (`src/lib/flights.ts`) — there's no LLM behind the chat. The
preset query at the top of `src/app/page.tsx` (`PRESET_QUERY`) seeds the
conversation; swap it or wire up a `<SearchInput>` if you want
free-form input.

## How the "Behind the calls" panel works

The panel is intentionally simple so you can copy the pattern:

1. **Client-side fetches** go through `useLoggedFetch()` from
   `src/lib/apiLog.tsx`. The wrapper records the call.
2. **Server-side proxies** in `src/app/api/*` use `btProxy()` from
   `src/lib/api.ts`, which captures the upstream URL / method / body /
   status / response and serializes it into a base64-encoded
   `X-BT-Trace` response header.
3. The client wrapper decodes that header and pushes a second entry
   ("Server → Basis Theory") so you see both hops without exposing your
   private key.
4. SDK calls (Elements `bt.tokens.create`, react-agentic
   `verifyEnrollment` / `verifyInstruction`) are logged manually from
   the components that invoke them.

For production code, you wouldn't ship the `X-BT-Trace` header — but for
a demo it's gold.

## Project layout

```
travel-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Whole demo flow lives here.
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
│   │   ├── BookingReceipt.tsx      # "Upcoming trip" summary
│   │   ├── BrandLogo.tsx
│   │   └── BehindTheCallsPanel.tsx
│   └── lib/
│       ├── api.ts                  # btProxy() + withTrace() helpers
│       ├── apiLog.tsx              # ApiLogProvider + useLoggedFetch()
│       ├── flights.ts              # Mock flight data + NL parser
│       └── types.ts                # Minimal BT agentic-commerce types
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Troubleshooting

- **"Verify Card" button stays disabled / SDK never loads.** The
  react-agentic SDK won't initialize on `http://`. Use
  `npm run dev:tunnel` and open the printed `https://*.trycloudflare.com`
  URL. Disable ad-blockers — they tend to block the card-network SDKs.
- **"BT_API_KEY environment variable is not set"** in the server logs.
  Your `.env.local` is missing or unreadable — `cp .env.example .env.local`
  and fill in the keys, then restart `next dev`.
- **The saved-card picker is empty even though you just saved a card.**
  The picker filters by `wallet_name === "SkyAgent"`. If you changed
  `WALLET_NAME` in the route but not in the page (or vice versa), the
  filter and the body fall out of sync. Keep them aligned.
- **Verification popup closes itself immediately.** Browser pop-up
  blockers. Allow popups for your tunnel domain.
- **`Tokenization returned no id`.** Public key mismatch between
  Elements (client) and the BT environment. Double-check
  `NEXT_PUBLIC_BT_API_KEY` and `NEXT_PUBLIC_BT_ENVIRONMENT` — both must
  point at the same tenant.

## License

[MIT](../LICENSE)
