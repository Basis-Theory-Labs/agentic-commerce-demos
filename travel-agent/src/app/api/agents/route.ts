import { btProxy, withTrace } from "@/lib/api";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await btProxy("/agents", { method: "POST", body });
  return withTrace(result, 201);
}
