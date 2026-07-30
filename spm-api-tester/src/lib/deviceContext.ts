// Device context sent ONLY on the `start` verify action (strict schemas 400
// on extra keys anywhere else). client_device_id is stable per device;
// client_reference_id is FRESH per start — it is Visa's session correlation
// key.

const DEVICE_ID_KEY = "bt_agentic_device_id";

let inMemoryDeviceId: string | null = null;

export function stableDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private mode) — fall back to a per-page id.
    inMemoryDeviceId ??= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    return inMemoryDeviceId;
  }
}

export function collectDeviceContext() {
  return {
    screen_height: window.screen.height,
    screen_width: window.screen.width,
    color_depth: window.screen.colorDepth,
    user_agent_string: navigator.userAgent,
    // Already a BCP 47 tag — the API canonicalizes case but rejects
    // underscore locales like en_US.
    language_code: navigator.language,
    // Browser-native IANA identifier, accepted directly.
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    java_script_enabled: true,
    client_device_id: stableDeviceId(),
    client_reference_id: crypto.randomUUID(),
    platform_type: "WEB",
  };
}
