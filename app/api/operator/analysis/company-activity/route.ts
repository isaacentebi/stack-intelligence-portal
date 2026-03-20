import { NextRequest, NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const path = `/v1/operator/analysis/company-activity${qs ? `?${qs}` : ""}`;
    const { response, payload } = await fetchEngineJson(path);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load company activity", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
