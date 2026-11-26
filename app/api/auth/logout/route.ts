import { NextResponse } from "next/server";
import { isProduction } from "@/lib/env";
import { isSameOrigin } from "@/lib/auth/request";
import { jsonError, NO_STORE } from "@/lib/auth/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return jsonError(403, "Permintaan ditolak.");
  }
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(isProduction(), 0));
  return response;
}
