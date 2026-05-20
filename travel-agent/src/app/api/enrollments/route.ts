import { btProxy, withTrace } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";

interface ListResult {
  data: Array<{ wallet_name?: string | null; status?: string }>;
  pagination?: { next_cursor?: string | null; has_more?: boolean };
}

const MAX_PAGES = 8;
const PAGE_SIZE = 100;
const WALLET_NAME = "SkyAgent";

export async function GET() {
  let cursor: string | undefined = undefined;
  const matches: ListResult["data"] = [];
  let lastTrace = null;
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages += 1;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);

    const result = await btProxy(`/enrollments?${params.toString()}`);
    lastTrace = result;
    if (!result.ok) return withTrace(result);

    const page = result.data as ListResult;
    for (const enrollment of page.data ?? []) {
      if (enrollment.wallet_name === WALLET_NAME) {
        matches.push(enrollment);
      }
    }

    const next = page.pagination?.next_cursor;
    const hasMore = page.pagination?.has_more;
    if (!hasMore || !next) break;
    cursor = next;
  }

  const headers = new Headers();
  if (lastTrace) {
    headers.set(
      "X-BT-Trace",
      Buffer.from(JSON.stringify(lastTrace.trace)).toString("base64"),
    );
  }
  return NextResponse.json(
    { data: matches, pagination: { has_more: false, next_cursor: null } },
    { headers },
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await btProxy("/enrollments", { method: "POST", body });
  return withTrace(result, 201);
}
