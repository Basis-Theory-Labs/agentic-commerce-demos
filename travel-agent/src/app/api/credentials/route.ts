import { btProxy, validateId, withTrace } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const instructionId = searchParams.get("instructionId");

  if (!agentId || !instructionId) {
    return NextResponse.json(
      { error: "agentId and instructionId are required" },
      { status: 400 }
    );
  }
  for (const [id, name] of [
    [agentId, "agentId"],
    [instructionId, "instructionId"],
  ] as const) {
    const err = validateId(id, name);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const body = await request.json();
  const result = await btProxy(
    `/agentic/agents/${agentId}/instructions/${instructionId}/credentials`,
    { method: "POST", body }
  );
  return withTrace(result);
}
