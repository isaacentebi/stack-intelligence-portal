import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const { response, payload } = await fetchEngineJson("/v1/operator/company/canary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run company canary",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
