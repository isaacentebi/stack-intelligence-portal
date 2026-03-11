import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const path = limit ? `/v1/operator/workflows/runs?limit=${encodeURIComponent(limit)}` : "/v1/operator/workflows/runs";

  try {
    const { response, payload } = await fetchEngineJson(path);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load workflow runs from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
