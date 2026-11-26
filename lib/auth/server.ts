/**
 * Penghubung autentikasi dengan route API Next.js.
 */
import { NextResponse } from "next/server";
import { ConfigError, getJwtSecret } from "../env";
import { nameKey } from "../format/text";
import { explainGoogleError, GoogleApiError } from "../google/errors";
import { getUserDirectory } from "../google/database";
import { SheetFormatError } from "../google/parse";
import { readCookie } from "./request";
import { passwordFingerprint, SESSION_COOKIE, verifySessionToken, type SessionClaims } from "./session";
import { roleOf, SUBCONT_ONLY_MESSAGE, type Role } from "./role";

export interface ActiveSession {
  subcontName: string;
  role: Role;
  claims: SessionClaims;
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(status: number, message: string, extraHeaders: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

/**
 * Sesi aktif dari cookie, atau null. Selain tanda tangan dan masa berlaku,
 * akun harus masih ada di database dan password belum diganti.
 */
export async function getActiveSession(request: Request): Promise<ActiveSession | null> {
  const claims = verifySessionToken(readCookie(request.headers, SESSION_COOKIE), getJwtSecret());
  if (!claims) return null;

  const directory = await getUserDirectory();
  const user = directory.users.get(nameKey(claims.sub));
  if (!user) return null;
  if (passwordFingerprint(user.password, getJwtSecret()) !== claims.pwf) return null;

  return { subcontName: user.name, role: roleOf(user.name), claims };
}

/** Respons 403 bila sesi bukan subcont (fitur Visit). null = boleh lanjut. */
export function rejectIfNotSubcont(session: ActiveSession): NextResponse | null {
  return session.role === "subcont" ? null : jsonError(403, SUBCONT_ONLY_MESSAGE);
}

/**
 * Menerjemahkan galat server menjadi respons ramah.
 * Detail teknis hanya ke log server; tidak pernah memuat password atau token.
 */
export function serverErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof ConfigError) {
    console.error(`[WHControl] ${context}: konfigurasi belum lengkap. ${err.message}`);
  } else if (err instanceof GoogleApiError) {
    console.error(`[WHControl] ${context}: ${explainGoogleError(err)} (status ${err.status}, ${err.code})`);
  } else if (err instanceof SheetFormatError) {
    console.error(`[WHControl] ${context}: format sheet tidak sesuai. ${err.message}`);
  } else {
    console.error(`[WHControl] ${context}: galat tidak terduga.`, err instanceof Error ? err.message : "");
  }
  return jsonError(503, "Layanan sedang bermasalah. Coba lagi beberapa saat lagi.");
}
