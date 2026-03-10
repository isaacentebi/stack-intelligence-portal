import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";
import type { ResearchLivePayload } from "@/lib/research-dashboard/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { response, payload } = await fetchEngineJson<ResearchLivePayload>("/v1/research/live");
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load engine research payload",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
