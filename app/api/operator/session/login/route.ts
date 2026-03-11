import { NextResponse } from "next/server";
import {
  isValidOperatorLogin,
  operatorSessionCookie,
  operatorSessionCookieName,
} from "@/lib/operator-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = String(body.email ?? "");
  const password = String(body.password ?? "");

  if (!isValidOperatorLogin(email, password)) {
    return NextResponse.json(
      {
        error: "Invalid operator credentials",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    email: email.toLowerCase().trim(),
  });
  response.cookies.set(operatorSessionCookie(operatorSessionCookieName(), email));
  return response;
}
