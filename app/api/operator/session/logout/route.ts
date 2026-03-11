import { NextResponse } from "next/server";
import {
  clearOperatorSessionCookie,
  operatorSessionCookieName,
} from "@/lib/operator-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearOperatorSessionCookie(operatorSessionCookieName()));
  return response;
}
