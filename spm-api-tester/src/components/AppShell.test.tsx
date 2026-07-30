import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EnvironmentContext } from "./AppShell";

describe("EnvironmentContext", () => {
  it("labels the agent, API endpoint, and tenant environment explicitly", () => {
    const html = renderToStaticMarkup(
      <EnvironmentContext
        displayName="Example Agent"
        apiUrl="http://localhost:3001/api"
        tenantType="production"
      />,
    );

    expect(html).toContain("Agent");
    expect(html).toContain("Example Agent");
    expect(html).toContain("API endpoint");
    expect(html).toContain("http://localhost:3001/api");
    expect(html).toContain("Production tenant");
  });
});
