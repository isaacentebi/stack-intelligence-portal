import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/operator-session";

export async function requireOperatorApiSession() {
  const session = await getOperatorSession();
  if (!session) {
    return {
      session: null,
      unauthorized: NextResponse.json(
        {
          error: "Operator session required",
        },
        { status: 401 },
      ),
    };
  }

  return {
    session,
    unauthorized: null,
  };
}
