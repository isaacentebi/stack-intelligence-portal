import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const DEFAULT_INVESTOR_HASH = "Y2xhbmtlcg==";
const SESSION_COOKIE_NAME = "stack_operator_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const ALLOWED_EMAILS = ["marcos@thestack.capital", "isaac@thestack.capital"];

export type OperatorSession = {
  email: string;
  issued_at: string;
  expires_at: string;
};

type SignedSessionPayload = OperatorSession;

function getOperatorAccessHash() {
  return (
    process.env.OPERATOR_ACCESS_HASH ??
    process.env.NEXT_PUBLIC_INVESTOR_ACCESS_HASH ??
    DEFAULT_INVESTOR_HASH
  );
}

function getOperatorSessionSecret() {
  return process.env.OPERATOR_SESSION_SECRET ?? getOperatorAccessHash();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getOperatorSessionSecret()).update(payload).digest("base64url");
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function cookieValueForSession(session: SignedSessionPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(session));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function isValidOperatorLogin(email: string, password: string) {
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim()) && Buffer.from(password, "utf8").toString("base64") === getOperatorAccessHash();
}

export function createOperatorSession(email: string): OperatorSession {
  const issuedAtSeconds = nowUnixSeconds();
  const expiresAtSeconds = issuedAtSeconds + SESSION_TTL_SECONDS;

  return {
    email: email.toLowerCase().trim(),
    issued_at: new Date(issuedAtSeconds * 1000).toISOString(),
    expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function verifyOperatorSessionCookie(value: string | undefined): OperatorSession | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, encodedSignature] = value.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const actual = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as SignedSessionPayload;
    if (!parsed.email || !parsed.expires_at || !parsed.issued_at) {
      return null;
    }
    if (Date.parse(parsed.expires_at) <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getOperatorSession() {
  const cookieStore = await cookies();
  return verifyOperatorSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function operatorSessionCookie(name: string, email: string) {
  return {
    name,
    value: cookieValueForSession(createOperatorSession(email)),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearOperatorSessionCookie(name: string) {
  return {
    name,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function operatorSessionCookieName() {
  return SESSION_COOKIE_NAME;
}
