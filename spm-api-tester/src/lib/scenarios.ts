// Single source of truth for the SPM test-PAN catalog. The card picker, the
// step-level reminder chips, and the README scenario table all render from
// this module — edit it here and every surface stays in sync.
//
// Verified against agentic-commerce mock providers:
//   src/providers/rails/mock-verification.js, src/providers/{visa,mastercard,stripe}/mock-*.js

export type CardBrand = "visa" | "mastercard";

/** The step of the flow where the scenario's behavior becomes visible. */
export type ScenarioStage = "payment-method" | "verify" | "credentials";

export type ScenarioTone = "success" | "warning" | "error";

export interface CardScenario {
  pan: string;
  brand: CardBrand;
  /** Short badge text shown on the card tile. */
  badge: string;
  tone: ScenarioTone;
  /** One-line description of what this card demonstrates. */
  description: string;
  /** Where the scenario manifests, and what to expect there. */
  manifestsAt: ScenarioStage;
  /** RFC 7807 error `type` the scenario produces, if it produces one. */
  expectedErrorType?: string;
  /** Reminder chip copy surfaced at the manifesting step. */
  reminder: string;
}

export const CARD_SCENARIOS: CardScenario[] = [
  {
    pan: "4242424242424242",
    brand: "visa",
    badge: "Happy path",
    tone: "success",
    description: "Visa verification succeeds: OTP, REGISTER passkey, restart, AUTHENTICATE passkey.",
    manifestsAt: "verify",
    reminder:
      "Happy-path Visa card: OTP, a REGISTER passkey ceremony, a restart, then AUTHENTICATE. Any OTP code works on test tenants.",
  },
  {
    pan: "4929980395567582",
    brand: "visa",
    badge: "Invalid OTP",
    tone: "error",
    description: "Every submit_otp attempt fails with 400 INVALID_OTP.",
    manifestsAt: "verify",
    expectedErrorType: "INVALID_OTP",
    reminder:
      "You picked the invalid-OTP card: every submit_otp will 400 with INVALID_OTP, no matter the code.",
  },
  {
    pan: "5555555555554444",
    brand: "mastercard",
    badge: "Happy path",
    tone: "success",
    description: "Mastercard verification succeeds: hosted ceremony, then complete.",
    manifestsAt: "verify",
    reminder:
      "Happy-path Mastercard card: the hosted ceremony popup posts a completion cue, then the complete action activates the rail.",
  },
  {
    pan: "5186160000000001",
    brand: "mastercard",
    badge: "Rail rejected",
    tone: "error",
    description:
      "Mastercard rejects the agentic-token rail at creation (CARD_REJECTED); the spt rail stays usable.",
    manifestsAt: "payment-method",
    expectedErrorType: "CARD_REJECTED",
    reminder:
      "You picked the network-rejected card: the agentic-token rail reports error CARD_REJECTED; spt remains enabled.",
  },
  {
    pan: "5186160000000003",
    brand: "mastercard",
    badge: "Complete fails",
    tone: "error",
    description: "The Mastercard ceremony runs, but the complete action fails with 422.",
    manifestsAt: "verify",
    expectedErrorType: "PROVIDER_VERIFICATION_FAILED",
    reminder:
      "You picked the complete-failure card: the ceremony will look fine, then `complete` 422s with PROVIDER_VERIFICATION_FAILED.",
  },
  {
    pan: "4000000000000002",
    brand: "visa",
    badge: "spt rejected",
    tone: "error",
    description:
      "Stripe rejects the spt rail at creation (CARD_REJECTED); retrying keeps failing.",
    manifestsAt: "payment-method",
    expectedErrorType: "CARD_REJECTED",
    reminder:
      "You picked the spt-rejected card: the spt rail reports error CARD_REJECTED and retry stays rejected.",
  },
  {
    pan: "4000000000000119",
    brand: "visa",
    badge: "Retry succeeds",
    tone: "warning",
    description:
      "The spt rail fails on create (PROVIDER_ENROLLMENT_FAILED); a rails retry enables it.",
    manifestsAt: "payment-method",
    expectedErrorType: "PROVIDER_ENROLLMENT_FAILED",
    reminder:
      "You picked the retry-succeeds card: the spt rail errors on create — send a rails retry and watch it flip to enabled.",
  },
  {
    pan: "4000000000000341",
    brand: "visa",
    badge: "Mint fails",
    tone: "error",
    description:
      "spt credential mint fails with 422 PROVIDER_CREDENTIALS_FAILED; the spend reservation is released.",
    manifestsAt: "credentials",
    expectedErrorType: "PROVIDER_CREDENTIALS_FAILED",
    reminder:
      "You picked the credential-error card: this spt mint will 422 with PROVIDER_CREDENTIALS_FAILED and the reservation is released — amount_available recovers.",
  },
  {
    pan: "4000000000009995",
    brand: "visa",
    badge: "Unknown outcome",
    tone: "error",
    description:
      "spt credential mint ends in an unknown provider outcome (409); the reservation is burned to amount_spent.",
    manifestsAt: "credentials",
    expectedErrorType: "CREDENTIAL_OUTCOME_UNKNOWN",
    reminder:
      "You picked the unknown-outcome card: this spt mint 409s and the reserved amount is burned to amount_spent — no release, no retry.",
  },
];

/** The fallback behavior for any PAN not in the catalog. */
export const DEFAULT_SCENARIO_NOTE =
  "Any other Visa or Mastercard PAN follows that brand's happy path.";

/**
 * What the mocks cannot produce — surfaced in the Verify step and the README
 * so nobody wastes an afternoon trying to simulate these with test cards.
 */
export const NOT_SIMULATABLE: string[] = [
  "MAX_ATTEMPTS_EXCEEDED — the mock accepts unlimited OTP attempts",
  "PASSKEY_FAILED — the mock passkey ceremony always succeeds",
  "Mastercard PENDING on complete — the mock resolves immediately (real Mastercard can return pending; the bounded poll ships anyway)",
  "An `error` allowance rail — allowance rails/retry cannot be demonstrated",
  "NO_ACTIVE_RAILS — mock allowances always provision at least one rail",
  "Visa enrollment failure at payment-method creation",
];

export function findScenario(pan: string): CardScenario | undefined {
  return CARD_SCENARIOS.find((s) => s.pan === pan);
}

/** Scenarios whose payoff lands at the given step, for reminder chips. */
export function scenariosAt(stage: ScenarioStage): CardScenario[] {
  return CARD_SCENARIOS.filter((s) => s.manifestsAt === stage);
}
