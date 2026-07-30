import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HighlightedCode, tokenizeCode } from "@/components/ui/HighlightedCode";

describe("HighlightedCode", () => {
  it("classifies JSON values without changing their content", () => {
    const source = '{"status":"active","attempts":2,"ok":true,"error":null}';
    const tokens = tokenizeCode(source, "json");

    expect(tokens.map((token) => token.value).join("")).toBe(source);
    expect(tokens).toEqual(
      expect.arrayContaining([
        { kind: "property", value: '"status"' },
        { kind: "string", value: '"active"' },
        { kind: "number", value: "2" },
        { kind: "boolean", value: "true" },
        { kind: "null", value: "null" },
      ]),
    );
  });

  it("renders source as text rather than executable markup", () => {
    const markup = renderToStaticMarkup(
      <HighlightedCode code={'{"value":"<script>alert(1)</script>"}'} language="json" />,
    );

    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });
});
