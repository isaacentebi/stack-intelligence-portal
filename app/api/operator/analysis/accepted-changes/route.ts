import { NextRequest, NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const path = `/v1/operator/analysis/accepted-changes${qs ? `?${qs}` : ""}`;
    const { response, payload } = await fetchEngineJson(path);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load accepted changes", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
