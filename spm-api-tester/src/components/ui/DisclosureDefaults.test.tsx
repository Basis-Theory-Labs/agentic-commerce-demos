import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { JsonEditor } from "@/components/ui/JsonEditor";

describe("teaching artifact disclosure defaults", () => {
  it("opens code examples by default while preserving an explicit collapsed option", () => {
    const open = renderToStaticMarkup(<CodeBlock title="Example" code="const value = 1;" />);
    const collapsed = renderToStaticMarkup(
      <CodeBlock title="Example" code="const value = 1;" defaultOpen={false} />,
    );

    expect(open).toContain('open=""');
    expect(collapsed).not.toContain('open=""');
  });

  it("opens editable JSON request bodies by default", () => {
    const value = JSON.stringify({ amount: "5.00" }, null, 2);
    const html = renderToStaticMarkup(
      <JsonEditor value={value} defaultValue={value} onChange={() => undefined} />,
    );

    expect(html).toContain('open=""');
    expect(html).toContain("JSON body");
    expect(html).toContain("amount");
  });
});
