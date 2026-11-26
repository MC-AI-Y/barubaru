import { NextResponse } from "next/server";
import { getJwtSecret, isProduction } from "@/lib/env";
import { getUserDirectory } from "@/lib/google/database";
import { attemptLogin, LOGIN_FAILED_MESSAGE, parseLoginBody } from "@/lib/auth/login";
import { loginIpLimiter, loginNameLimiter } from "@/lib/auth/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/auth/request";
import { jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";
import { roleOf } from "@/lib/auth/role";
import { createSessionToken, passwordFingerprint, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jeda acak setiap login gagal untuk memperlambat tebakan password. */
const failureDelay = () => new Promise((resolve) => setTimeout(resolve, 400 + Math.floor(Math.random() * 300)));

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return jsonError(403, "Permintaan ditolak.");
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonError(415, "Format permintaan tidak didukung.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }

  // Catatan: body (berisi password) TIDAK pernah dicatat ke log.
  const input = parseLoginBody(body);
  if (!input) {
    return jsonError(400, "Subcont Name dan password wajib diisi.");
  }

  try {
    const secret = getJwtSecret();
    const result = await attemptLogin(
      { ...input, clientIp: getClientIp(request.headers) },
      { getDirectory: getUserDirectory, ipLimiter: loginIpLimiter, nameLimiter: loginNameLimiter },
    );

    if (!result.ok && result.reason === "rate_limited") {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return jsonError(429, `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.`, {
        "Retry-After": String(result.retryAfterSeconds),
      });
    }

    if (!result.ok) {
      await failureDelay();
      return jsonError(401, LOGIN_FAILED_MESSAGE);
    }

    const { token } = createSessionToken(result.subcontName, passwordFingerprint(result.password, secret), secret);
    const response = NextResponse.json({ subcontName: result.subcontName, role: roleOf(result.subcontName) }, { headers: NO_STORE });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(isProduction()));
    return response;
  } catch (err) {
    return serverErrorResponse(err, "Login");
  }
}
