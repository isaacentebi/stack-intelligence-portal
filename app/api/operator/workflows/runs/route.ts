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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    workflow_key?: string;
  };
  const workflowKey = String(body.workflow_key ?? "");

  if (!workflowKey) {
    return NextResponse.json(
      {
        error: "workflow_key is required",
      },
      { status: 400 },
    );
  }

  try {
    const { response, payload } = await fetchEngineJson(
      `/v1/operator/workflows/${encodeURIComponent(workflowKey)}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requested_by: "portal:operator",
        }),
      },
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to trigger workflow run through engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
