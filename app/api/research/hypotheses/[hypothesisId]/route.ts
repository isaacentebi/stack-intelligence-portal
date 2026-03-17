import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hypothesisId: string }> },
) {
  const { hypothesisId } = await params;

  try {
    const { response, payload } = await fetchEngineJson(
      `/v1/research/hypotheses/${encodeURIComponent(hypothesisId)}`,
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load hypothesis detail from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
