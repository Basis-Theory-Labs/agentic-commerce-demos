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
  const context: Record<string, string | number | boolean> = {
    screen_height: window.screen.height,
    screen_width: window.screen.width,
    color_depth: window.screen.colorDepth,
    user_agent_string: navigator.userAgent,
    java_script_enabled: true,
    client_device_id: stableDeviceId(),
    client_reference_id: crypto.randomUUID(),
    platform_type: "WEB",
  };
  // These optional fields are strictly validated. Locked-down webviews can
  // report an empty value, which must be omitted rather than sent as "".
  if (navigator.language) context.language_code = navigator.language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone) context.time_zone = timeZone;
  return context;
}
