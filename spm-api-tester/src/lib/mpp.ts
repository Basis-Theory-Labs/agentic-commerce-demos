// Machine Payments Protocol helpers: canonical JSON (JCS-style key sort) +
// unpadded base64url, matching what the API expects in `challenge.request`.

function canonicalize(item: unknown): string {
  if (item === null || typeof item !== "object") return JSON.stringify(item);
  if (Array.isArray(item)) return `[${item.map(canonicalize).join(",")}]`;
  const obj = item as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`)
    .join(",")}}`;
}

export function base64UrlJson(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalize(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Public-only fixture key for the local/test MPP Card walkthrough. Production
// uses the RSA encryption JWK supplied by the merchant's Payment challenge.
export const EXAMPLE_MPP_CARD_ENCRYPTION_JWK = {
  kty: "RSA",
  n: "wEiPyZHJF064r-fP9F10WSiMecvzI-2Tlu7lIyU0NlNq0hDUhhnR10Kw4W7lECsTQvdy3X1M9tUY0H203zLDN4F9jUiWp7e8TPAV9wbw-wbUjDzS_C7JCXvnDk3u-7brucPG37fFcvpKGYARHlvnGOrIpn1cunzxZSY2uy0CE9u-KPcVobQD06UdZn0mYrKMNVZEQxuOrsnzeNcSAS8IdbUM_LrEi_i2-deG_SlOw5UpVej4hMuYcVz1dR1FQN8U-B56xiySlzsF0q6wbrHK44Z7ggJBTpEuwMTT3iwnK582vHNxGeJq_XHeBwHuVFZ14jZD_TFJXm3KkgsLjCMAnw",
  e: "AQAB",
  kid: "example-mpp-key",
  use: "enc",
  alg: "RSA-OAEP-256",
};
