import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";
import { requireOperatorApiSession } from "@/lib/operator-api-auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { unauthorized } = await requireOperatorApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { runId } = await params;

  try {
    const { response, payload } = await fetchEngineJson(
      `/v1/operator/workflows/runs/${encodeURIComponent(runId)}`,
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load workflow run from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
