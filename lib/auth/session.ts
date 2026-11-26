/**
 * Token sesi bertanda tangan (format JWT, HS256) memakai JWT_SECRET.
 * Disimpan di cookie httpOnly sehingga tidak bisa dibaca JavaScript di browser.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "whc_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionClaims {
  /** Subcont Name persis seperti di database. */
  sub: string;
  /**
   * Sidik password saat login (HMAC, bukan password). Bila password diganti
   * di database, sesi lama otomatis tidak berlaku.
   */
  pwf: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Sidik password: 16 karakter HMAC. Tidak bisa dibalik menjadi password. */
export function passwordFingerprint(password: string, secret: string): string {
  return createHmac("sha256", secret).update(`pw:${password}`).digest("base64url").slice(0, 16);
}

const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export function createSessionToken(
  subcontName: string,
  pwf: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; claims: SessionClaims } {
  const claims: SessionClaims = { sub: subcontName, pwf, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS };
  const payload = b64url(JSON.stringify(claims));
  const unsigned = `${HEADER}.${payload}`;
  return { token: `${unsigned}.${sign(unsigned, secret)}`, claims };
}

/** Memeriksa tanda tangan dan masa berlaku. Mengembalikan null bila tidak sah. */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionClaims | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  if (header !== HEADER) return null;
  if (!safeEqual(signature, sign(`${header}.${payload}`, secret))) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isClaims(claims)) return null;
  if (claims.exp <= nowSeconds || claims.iat > nowSeconds + 60) return null;
  return claims;
}

function isClaims(value: unknown): value is SessionClaims {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === "string" &&
    v.sub.length > 0 &&
    typeof v.pwf === "string" &&
    typeof v.iat === "number" &&
    typeof v.exp === "number"
  );
}

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function sessionCookieOptions(secure: boolean, maxAge = SESSION_TTL_SECONDS): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge };
}
