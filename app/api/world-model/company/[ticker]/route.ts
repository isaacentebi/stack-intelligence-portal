import { NextResponse } from "next/server";
import { fetchEngineJson } from "@/lib/engine-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  try {
    const { response, payload } = await fetchEngineJson<{
      ticker: string;
      company: {
        nodes: Array<{
          layer_id: number;
          layer_name: string;
          node_id: string;
          node_name: string;
        }>;
      };
      summary: { node_count: number };
      detail?: string;
    }>(`/v1/world-model/companies/${encodeURIComponent(ticker)}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.detail ?? "Company not found" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      company: payload.ticker,
      appearances: payload.company.nodes.map((appearance) => ({
        layerId: appearance.layer_id,
        layerName: appearance.layer_name,
        nodeId: appearance.node_id,
        nodeTitle: appearance.node_name,
      })),
      nodeCount: payload.summary.node_count,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load company from engine",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
