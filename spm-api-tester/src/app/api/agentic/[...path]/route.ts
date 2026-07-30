import { NextRequest } from "next/server";
import { proxyAgentic } from "@/lib/proxy";

type Context = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: Context) {
  return proxyAgentic(request, (await context.params).path);
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
