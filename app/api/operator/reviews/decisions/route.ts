import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { response, payload } = await fetchEngineJson("/v1/operator/reviews/decisions");
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load decisions", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
