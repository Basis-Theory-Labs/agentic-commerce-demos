import { btProxy, withTrace } from "@/lib/api";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await btProxy("/agentic/agents");
  return withTrace(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await btProxy("/agentic/agents", { method: "POST", body });
  return withTrace(result, 201);
}
