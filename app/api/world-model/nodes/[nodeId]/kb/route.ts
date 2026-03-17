import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  try {
    const { nodeId } = await params;
    const { response, payload } = await fetchEngineJson(
      `/v1/world-model/nodes/${encodeURIComponent(nodeId)}/kb`,
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load node KB timeline",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
