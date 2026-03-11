import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";
import { requireOperatorApiSession } from "@/lib/operator-api-auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalKey: string }> },
) {
  const { unauthorized } = await requireOperatorApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { proposalKey } = await params;
  const body = await request.json();

  try {
    const { response, payload } = await fetchEngineJson(
      `/v1/operator/reviews/${encodeURIComponent(proposalKey)}/accept`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to accept review item through engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
