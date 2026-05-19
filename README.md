# Basis Theory · Agentic Commerce Demos

A growing collection of self-contained demos that show how to build with
[Basis Theory Agentic Commerce](https://developers.basistheory.com/) — the
APIs and SDKs that let an AI agent tokenize a card, enroll it with the
networks, mint a single-use virtual card scoped to a specific merchant +
amount, and "spend" it on the user's behalf.

Each demo is a stand-alone app (its own `package.json`, its own
`README.md`) so you can clone the repo, `cd` into one folder, and run it
without touching anything else.

## Demos

| Demo | Stack | What it shows |
|---|---|---|
| [`travel-agent/`](./travel-agent) | Next.js + Elements + react-agentic | Skyscanner-style chat assistant that searches flights, issues a single-use virtual card, and "books" the flight on a simulated airline checkout. Full new-card flow (tokenize → enroll → verify → instruction → verify → credentials) plus a saved-card fast path. Every API call is rendered live in a hideable "Behind the calls" panel. |

> More demos coming soon. Each will live in its own top-level folder with
> the same layout: standalone deps, `.env.example`, and a README walking
> you through the flow.

## What is "agentic commerce"?

In agentic commerce, the buyer is no longer the cardholder — it's an
**agent** acting on their behalf. The cardholder enrolls a card once
("you can use this for travel"), and the agent then asks the network for
a short-lived, single-use virtual card (PAN + CVC + expiry) bound to a
specific merchant and amount. The cardholder approves the spend via
passkey (Visa) or popup (Mastercard). The merchant sees a normal card
transaction; the cardholder never exposes the underlying card.

Basis Theory provides the primitives:

- **Tokens** — PCI-safe card storage via [Elements](https://developers.basistheory.com/docs/sdks/web/web-elements).
- **Agents** — long-lived identities that hold enrollment + spending capability.
- **Enrollments** — link a tokenized card to an agent and verify ownership with the network.
- **Instructions** — describe a specific intended purchase (merchant, amount, expiry).
- **Credentials** — short-lived single-use card numbers minted for one instruction.

See [developers.basistheory.com](https://developers.basistheory.com/) for the full reference.

## Prerequisites

Common to every demo:

- **Node.js 20+**
- A **Basis Theory account** with agentic commerce enabled
- Two API keys for the **same** environment (test or production):
  - `key_priv_…` — used server-side only
  - `key_pub_…` — used client-side (Elements + react-agentic)

Demos that exercise verification (passkeys / Mastercard popup) also need
[`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
or another HTTPS tunnel — the card-network SDKs refuse to run on
plain `http://`. See each demo's README for the `dev:tunnel` script.

## Getting started

```bash
git clone https://github.com/Basis-Theory/agentic-commerce-reference.git
cd agentic-commerce-reference/<demo-folder>
npm install
cp .env.example .env.local
# fill in your keys
npm run dev
```

Open the URL the dev server prints. Every demo includes a **Behind the
calls** panel that shows you which BT API calls fire at each step, with
the request and response bodies inlined — useful both as a walk-through
and as a copy-paste reference when you wire the same flow into your own
app.

## Test cards

Use any of the Basis Theory test cards in the test environment:

| Brand      | Number               | Notes |
|------------|----------------------|-------|
| Visa       | `4242 4242 4242 4242` | Passkey-only verification |
| Mastercard | `5200 0000 0000 1005` | Popup verification |

Pair them with any future expiry and any 3-digit CVC.

## Contributing

These demos are intentionally small and standalone so they're easy to
fork and adapt to your own merchant flow. PRs that fix bugs or add new
self-contained demos are welcome — open an issue first if you want to
add a new top-level demo so we can agree on scope.

## License

[MIT](./LICENSE)
