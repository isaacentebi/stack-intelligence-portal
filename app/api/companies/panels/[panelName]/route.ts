import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ panelName: string }> },
) {
  try {
    const { panelName } = await params;
    const { searchParams } = new URL(request.url);
    const { response, payload } = await fetchEngineJson(
      `/v1/companies/panels/${panelName}?${searchParams}`,
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load company panel from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
