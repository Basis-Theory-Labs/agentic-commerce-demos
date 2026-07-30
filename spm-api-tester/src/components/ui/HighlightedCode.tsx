import type { ReactNode } from "react";

export type CodeLanguage = "json" | "js" | "javascript" | "bash" | "shell" | "text";

type TokenKind =
  | "plain"
  | "property"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "keyword"
  | "function"
  | "comment"
  | "variable"
  | "flag";

export interface CodeToken {
  kind: TokenKind;
  value: string;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "text-ink-700",
  property: "text-syntax-property",
  string: "text-success",
  number: "text-warning",
  boolean: "text-syntax-keyword",
  null: "text-error",
  keyword: "text-syntax-keyword",
  function: "text-accent",
  comment: "text-ink-500 italic",
  variable: "text-syntax-variable",
  flag: "text-warning",
};

const JS_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "switch",
  "throw",
  "try",
  "typeof",
  "var",
  "while",
  "with",
  "yield",
]);

const JS_LITERALS = new Set(["false", "null", "true", "undefined"]);

function pushPlain(tokens: CodeToken[], value: string) {
  if (value) tokens.push({ kind: "plain", value });
}

function tokenizeWithPattern(
  source: string,
  pattern: RegExp,
  classify: (value: string, offset: number) => TokenKind,
): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const offset = match.index ?? 0;
    pushPlain(tokens, source.slice(cursor, offset));
    tokens.push({ kind: classify(match[0], offset), value: match[0] });
    cursor = offset + match[0].length;
  }

  pushPlain(tokens, source.slice(cursor));
  return tokens;
}

function tokenizeJson(source: string): CodeToken[] {
  const pattern =
    /"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;

  return tokenizeWithPattern(source, pattern, (value, offset) => {
    if (value.startsWith('"')) {
      return /^\s*:/.test(source.slice(offset + value.length)) ? "property" : "string";
    }
    if (value === "null") return "null";
    if (value === "true" || value === "false") return "boolean";
    return "number";
  });
}

function tokenizeJavaScript(source: string): CodeToken[] {
  const pattern =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|\b[A-Za-z_$][\w$]*\b|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

  return tokenizeWithPattern(source, pattern, (value, offset) => {
    if (value.startsWith("//") || value.startsWith("/*")) return "comment";
    if (value.startsWith('"') || value.startsWith("'") || value.startsWith("`")) {
      return "string";
    }
    if (/^-?\d/.test(value)) return "number";
    if (JS_LITERALS.has(value)) {
      if (value === "null" || value === "undefined") return "null";
      return "boolean";
    }
    if (JS_KEYWORDS.has(value)) return "keyword";
    if (/^\s*\(/.test(source.slice(offset + value.length))) return "function";
    return "plain";
  });
}

function tokenizeBash(source: string): CodeToken[] {
  const pattern =
    /#[^\n]*|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|--?[A-Za-z][A-Za-z0-9-]*|\b(?:curl|export|npm|npx|pnpm|yarn|cd|open)\b/g;

  return tokenizeWithPattern(source, pattern, (value) => {
    if (value.startsWith("#")) return "comment";
    if (value.startsWith('"') || value.startsWith("'")) return "string";
    if (value.startsWith("$")) return "variable";
    if (value.startsWith("-")) return "flag";
    return "function";
  });
}

export function tokenizeCode(source: string, language: CodeLanguage): CodeToken[] {
  if (language === "json") return tokenizeJson(source);
  if (language === "js" || language === "javascript") return tokenizeJavaScript(source);
  if (language === "bash" || language === "shell") return tokenizeBash(source);
  return [{ kind: "plain", value: source }];
}

export function HighlightedCode({
  code,
  language,
  className = "",
}: {
  code: string;
  language: CodeLanguage;
  className?: string;
}) {
  const children: ReactNode[] = tokenizeCode(code, language).map((token, index) => (
    <span key={`${index}-${token.kind}`} className={TOKEN_CLASS[token.kind]}>
      {token.value}
    </span>
  ));

  return <code className={className}>{children}</code>;
}
