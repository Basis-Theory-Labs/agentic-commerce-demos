# Basis Theory · Agentic Commerce Demos

A collection of self-contained demos that show how to build with
[Basis Theory Agentic Commerce](https://developers.basistheory.com/) — the
APIs and SDKs that let an agent tokenize a card, enroll it with the
networks, mint a single-use virtual card scoped to a specific merchant
and amount, and "spend" it on the user's behalf.

Each demo is a stand-alone app (its own `package.json`, its own
`README.md`). Clone the repo, `cd` into a folder, and run it.

## Demos

| Demo | Stack | What it shows |
|---|---|---|
| [`travel-agent/`](./travel-agent) | Next.js + Elements + react-agentic | A chat assistant that searches flights, issues a single-use virtual card, and "books" the flight on a simulated airline checkout. Full new-card flow (tokenize → enroll → verify → instruction → verify → credentials) plus a saved-card fast path. Every API call is rendered live in a hideable "Behind the calls" panel. |

## What is "agentic commerce"?

In agentic commerce, the buyer is no longer the cardholder — it's an
**agent** acting on their behalf. The cardholder enrolls a card once
("you can use this for travel"), and the agent then asks the network for
a short-lived, single-use virtual card (PAN + CVC + expiry) bound to a
specific merchant and amount. The cardholder approves the spend via
passkey. The merchant sees a normal card transaction; the cardholder
never exposes the underlying card.

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
  - `key_priv_…` — server-side only
  - `key_pub_…` — client-side (Elements + react-agentic)

Demos that exercise verification also need an HTTPS tunnel — the
card-network SDKs won't run on plain `http://`. Each demo ships a
`dev:tunnel` script that uses a free HTTPS tunnel. See the demo's
README.

## Getting started

```bash
git clone https://github.com/Basis-Theory/agentic-commerce-demos.git
cd agentic-commerce-demos/<demo-folder>
npm install
cp .env.example .env.local
# fill in your keys
npm run dev
```

Open the URL the dev server prints. Every demo includes a **Behind the
calls** panel that shows you which Basis Theory API calls fire at each
step, with the request and response bodies inlined — useful as a
walk-through and as a copy-paste reference when you wire the same flow
into your own app.

## Test cards

Use any of the Basis Theory test cards in the test environment:

| Brand      | Number               |
|------------|----------------------|
| Visa       | `4242 4242 4242 4242` |
| Mastercard | `5200 0000 0000 1005` |

Pair them with any future expiry and any 3-digit CVC.

## Contributing

These demos are intentionally small and standalone so they're easy to
fork and adapt to your own merchant flow. PRs that fix bugs or add new
self-contained demos are welcome — open an issue first if you want to
add a new top-level demo so we can agree on scope.

## License

[MIT](./LICENSE)
