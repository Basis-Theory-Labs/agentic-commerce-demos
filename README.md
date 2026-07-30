# Basis Theory · Agentic Commerce Demos

A collection of self-contained demos that show how to build with
[Basis Theory Agentic Commerce](https://developers.basistheory.com/) — the
APIs and SDKs that let an agent tokenize a card, enroll it with the
networks, mint a single-use virtual card scoped to a specific merchant
and amount, and "spend" it on the user's behalf.

Each demo is a stand-alone app (its own `package.json`, its own
`README.md`). Clone the repo, `cd` into a folder, and run it.

## Demos

| Demo | What it shows |
|---|---|
| [`spm-api-tester/`](./spm-api-tester) | **Current SPM reference.** A customer-ready, editable walkthrough of payment methods, allowances, Visa/Mastercard verification, rail retry, and every credential format. |
| [`travel-agent/`](./travel-agent) | **Legacy API demo.** A travel assistant using agents, enrollments, and instructions. Retained for compatibility and regression testing. |

## Current model: Shared Payment Model

New integrations should use the Shared Payment Model:

- **Payment methods** tokenize a funding source and provision independent rails.
- **Allowances** capture user-authorized merchant, amount, and expiry constraints.
- **Verification** advances explicit network ceremonies.
- **Credentials** mint an explicit output format for one spend.

Start with [`spm-api-tester/`](./spm-api-tester).

## Legacy model

In agentic commerce, the buyer is no longer the cardholder — it's an
**agent** acting on their behalf. The cardholder enrolls a card once
("you can use this for travel"), and the agent then asks the network for
a short-lived, single-use virtual card (PAN + CVC + expiry) bound to a
specific merchant and amount. The cardholder approves the spend via
passkey. The merchant sees a normal card transaction; the cardholder
never exposes the underlying card.

The travel-agent demo uses the original compatibility resources:

- **Tokens** — PCI-safe card storage via [Elements](https://developers.basistheory.com/docs/sdks/web/web-elements).
- **Agents** — long-lived identities that hold enrollment + spending capability.
- **Enrollments** — link a tokenized card to an agent and verify ownership with the network.
- **Instructions** — describe a specific intended purchase (merchant, amount, expiry).
- **Credentials** — short-lived single-use card numbers minted for one instruction.

Do not use these resources as the starting point for a new integration.

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

Open the URL the dev server prints. Every demo includes an API call
inspector — the **Inspector** in the SPM tester, the **Behind the
calls** panel in travel-agent — that shows you which Basis Theory API
calls fire at each step, with the request and response bodies inlined —
useful as a walk-through and as a copy-paste reference when you wire
the same flow into your own app.

## Test cards

Use any of the Basis Theory test cards in the test environment:

| Brand      | Number               |
|------------|----------------------|
| Visa       | `4242 4242 4242 4242` |
| Mastercard | `5555 5555 5555 4444` |

The SPM tester covers seven additional scenario cards — invalid OTP, rail
rejections, retry-succeeds, credential failure, and unknown-outcome. See its
[complete scenario matrix](./spm-api-tester#test-scenarios).

Pair them with any future expiry and any 3-digit CVC.

## Contributing

These demos are intentionally small and standalone so they're easy to
fork and adapt to your own merchant flow. PRs that fix bugs or add new
self-contained demos are welcome — open an issue first if you want to
add a new top-level demo so we can agree on scope.

## License

[MIT](./LICENSE)
