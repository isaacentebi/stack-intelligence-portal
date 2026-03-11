import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";
import { requireOperatorApiSession } from "@/lib/operator-api-auth";

export const runtime = "nodejs";

export async function GET() {
  const { unauthorized } = await requireOperatorApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { response, payload } = await fetchEngineJson("/v1/operator/publications");
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load publications from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
