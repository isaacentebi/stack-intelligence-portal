import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scenarioSetId: string }> },
) {
  const { scenarioSetId } = await params;

  try {
    const { response, payload } = await fetchEngineJson(
      `/v1/research/scenarios/${encodeURIComponent(scenarioSetId)}`,
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load scenario set detail from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
