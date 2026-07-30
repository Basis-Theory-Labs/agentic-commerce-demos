// Integration snippets shown next to the manual verify surfaces. Each one
// mirrors the behavior of this app's own implementation (visaCeremony.ts,
// mastercardCeremony.ts, the verify loop in VerifyPanel) — including the
// security details the old embedded snippets skipped: the Mastercard
// event.origin check and the bounded `complete` pending poll.

export const SNIPPET_LOOP = `// One loop drives every ceremony, on every network.
// verify() posts to /allowances/{id}/verify with your PUBLIC key.
let state = await verify({
  action: 'start',
  rail: 'agentic-token',
  provider,                       // from the allowance's rails[] entry
  display_name: 'Your App',
  device_context: collectDeviceContext(),
});

while (state.status !== 'active') {
  switch (state.next_action.type) {
    case 'passkey_session':   state = await submitVisaSession(state.next_action); break;
    case 'select_otp_method': state = await chooseOtpMethod(state.next_action);   break;
    case 'otp':               state = await collectOtpCode(state.next_action);    break;
    case 'passkey':           state = await runVisaCeremony(state.next_action);   break;
    case 'redirect':          state = await runMastercardAuth(state.next_action); break;
    default: throw new Error(\`Unknown next_action: \${state.next_action.type}\`);
  }
}`;

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
//    Open the popup SYNCHRONOUSLY from a click — after any await, user
//    activation is lost and WebAuthn will not run.
const a = await visaSession.authenticate(result.next_action.passkey_context);

// 4a. REGISTER never activates the rail. Restart with a fresh start call
//     (fresh device_context); the next ceremony comes back AUTHENTICATE.
if (result.next_action.passkey_context.action === 'REGISTER') {
  return verify({ action: 'start', rail: 'agentic-token', provider: 'vic',
                  display_name: 'Your App', device_context: collectDeviceContext() });
}

// 4b. AUTHENTICATE: map Visa's camelCase result onto the wire shape.
//     dfp_session_id comes from the POPUP result's rpID — not the session
//     iframe's dfpSessionID.
return verify({
  action: 'submit_passkey',
  rail: 'agentic-token', provider: 'vic',
  assurance_data: {
    identifier: a.identifier,
    dfp_session_id: a.rpID,
    fido_assertion_data: { code: a.fidoBlob },
  },
});`;

export const SNIPPET_REDIRECT = `// 1. Open Mastercard's hosted page top-level — their pages send
//    X-Frame-Options: DENY, so an iframe can never work.
const popup = window.open(nextAction.uri, 'mc-auth', 'width=480,height=720');

// 2. The callback bridge posts a cue when the cardholder finishes. It posts
//    with targetOrigin '*', so validate BOTH the source window AND the
//    origin against your Basis Theory API origin.
const API_ORIGINS = ['https://api.basistheory.com', 'https://api.test.basistheory.com'];
window.addEventListener('message', (event) => {
  if (event.source !== popup) return;
  if (!API_ORIGINS.includes(event.origin)) return;
  if (event.data?.type !== 'mastercard_verification_complete') return;
  popup.close();
  completeWithPolling(); // the cue is NOT a result — complete is
});

// 3. Only \`complete\` is authoritative — and real Mastercard can leave it
//    pending (verification_required with no next_action). Poll, bounded.
//    (The Basis Theory mock never returns pending; real Mastercard does.)
async function completeWithPolling() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const state = await verify({ action: 'complete', rail: 'agentic-token', provider: 'agentpay' });
    if (state.status === 'active' || state.next_action) return render(state);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Verification still pending — retry complete shortly.');
}`;
