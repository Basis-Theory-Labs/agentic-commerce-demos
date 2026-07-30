// Integration snippets shown next to the manual verify surfaces. Each one
// mirrors the behavior of this app's own implementation (visaCeremony.ts,
// mastercardCeremony.ts, the verify loop in VerifyPanel) — including the
// security details the old embedded snippets skipped: the Mastercard
// event.origin check and the bounded `complete` pending poll.

export const SNIPPET_LOOP = `// One state machine drives every network. API-only actions can advance
// inline; popup actions render a button and RETURN so the popup opens in a
// fresh cardholder click stack (never after an await).
// verify() posts to /allowances/{id}/verify with your PUBLIC key.
async function advance(state) {
  while (state.status !== 'active') {
    switch (state.next_action.type) {
      case 'passkey_session':   state = await submitVisaSession(state.next_action); break;
      case 'select_otp_method': state = await chooseOtpMethod(state.next_action);   break;
      case 'otp':               state = await collectOtpCode(state.next_action);    break;
      case 'passkey':
        return renderVisaButton(() => runVisaFromClick(state.next_action, advance));
      case 'redirect':
        return renderMastercardButton(() => runMastercardFromClick(state.next_action, advance));
      default: throw new Error(\`Unknown next_action: \${state.next_action.type}\`);
    }
  }
  renderActive(state);
}

advance(await verify({
  action: 'start',
  rail: 'agentic-token',
  provider,                       // from the allowance's rails[] entry
  display_name: 'Your App',
  device_context: collectDeviceContext(),
}));`;

export const SNIPPET_PASSKEY = `// 1. A passkey_session action arrives first. Mount the hosted iframe from
//    next_action.embed (served by the API — never hardcode it), wait for
//    AUTH_READY, send CREATE_AUTH_SESSION, keep the returned secure token.
const visaSession = await initVisaIframe(nextAction.embed);

// 2. Submit only the secure token. The API retained the device context and
//    display name from the original start call — do not resend them.
let result = await verify({
  action: 'submit_session',
  rail: 'agentic-token', provider: 'vic',
  session_context: { secure_token: visaSession.secureToken },
});

// 3. The later passkey action carries the ceremony Visa chose:
//    AUTHENTICATE — a payment passkey already exists on this device.
//    REGISTER     — no passkey yet; the popup creates one.
//    Wire this NON-ASYNC function directly to the button. authenticate()
//    opens synchronously before any await can consume user activation.
function runVisaFromClick(nextAction, advance) {
  const ceremony = visaSession.authenticate(nextAction.passkey_context);
  void ceremony.then(async (assuranceData) => {
    // 4a. REGISTER never activates the rail. Restart with a fresh start call
    //     (fresh device_context); the next ceremony is AUTHENTICATE.
    if (nextAction.passkey_context.action === 'REGISTER') {
      return advance(await verify({
        action: 'start', rail: 'agentic-token', provider: 'vic',
        display_name: 'Your App', device_context: collectDeviceContext(),
      }));
    }

    // 4b. AUTHENTICATE: this helper already mapped the popup's camelCase
    //     {identifier, rpID, fidoBlob} onto the API's assurance_data shape.
    //     dfp_session_id came from popup rpID, not iframe dfpSessionID.
    return advance(await verify({
      action: 'submit_passkey',
      rail: 'agentic-token', provider: 'vic',
      assurance_data: assuranceData,
    }));
  }).catch(renderCeremonyError);
}
renderVisaButton(() => runVisaFromClick(result.next_action, advance));`;

export const SNIPPET_REDIRECT = `// Wire this NON-ASYNC function directly to the Authenticate button.
// window.open is the first meaningful operation, preserving user activation.
function runMastercardFromClick(nextAction, advance) {
  // Mastercard sends X-Frame-Options: DENY, so it must open top-level.
  const popup = window.open(nextAction.uri, 'mc-auth', 'width=480,height=720');
  if (!popup) throw new Error('Mastercard popup blocked — ask for another click.');

  // The callback bridge posts a cue with targetOrigin '*'. Validate BOTH the
  // source window and origin against your Basis Theory API origin.
  const API_ORIGINS = new Set([
    'https://api.basistheory.com',
    'https://api.test.basistheory.com',
    new URL(AGENTIC_API_URL).origin, // includes local or custom API hosts
  ]);
  let closeWatcher;
  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    if (closeWatcher) clearInterval(closeWatcher);
  };
  const onMessage = (event) => {
    if (event.source !== popup) return;
    if (!API_ORIGINS.has(event.origin)) return;
    if (event.data?.type !== 'mastercard_verification_complete') return;
    cleanup();
    popup.close();
    renderCompletionCue(); // a cue, never the authoritative result
  };
  window.addEventListener('message', onMessage);
  closeWatcher = setInterval(() => {
    if (!popup.closed) return;
    cleanup();
    renderCompletionCue();
  }, 500);

  // Offer Complete immediately. The bridge may be lost even while the popup
  // stays open; pressing this closes/cleans up the ceremony and probes the
  // authoritative server-side result.
  renderCompleteButton(async () => {
    cleanup();
    if (!popup.closed) popup.close();
    return advance(await completeWithPolling());
  });
}
renderMastercardButton(() => runMastercardFromClick(nextAction, advance));

// Only \`complete\` is authoritative. Real Mastercard can leave it pending
// (verification_required with no next_action), so poll with a hard bound.
async function completeWithPolling() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const state = await verify({ action: 'complete', rail: 'agentic-token', provider: 'agentpay' });
    if (state.status === 'active' || state.next_action) return state;
    if (attempt < 10) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Verification still pending — retry complete shortly.');
}`;
