import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RequestPanel } from "@/components/RequestPanel";
import { ApiLogProvider } from "@/lib/apiLog";
import { ToastProvider } from "@/lib/toast";

describe("RequestPanel idempotency control", () => {
  it("keeps the header opt-in and reveals its value editor only when enabled", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <ApiLogProvider>
          <ToastProvider>
            <RequestPanel
              method="POST"
              path="/allowances"
              auth="proxy"
              defaultBody={{ amount: { value: "5.00", currency: "USD" } }}
              idempotency
            />
          </ToastProvider>
        </ApiLogProvider>,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).not.toContain("Create safety");
    expect(container.querySelector('[aria-label="BT-IDEMPOTENCY-KEY value"]')).toBeNull();

    act(() => toggle?.click());

    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[aria-label="BT-IDEMPOTENCY-KEY value"]')).not.toBeNull();

    act(() => root.unmount());
  });
});
