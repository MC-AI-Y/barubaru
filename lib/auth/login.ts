/**
 * Logika login inti (tanpa ketergantungan Next.js agar bisa diuji).
 * Aturan: readme bagian 10.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { collapseSpaces, nameKey } from "../format/text";
import type { UserDirectory } from "../google/parse";
import type { SlidingWindowLimiter } from "./rate-limit";

export const LOGIN_FAILED_MESSAGE = "Subcont atau password salah";
export const MAX_INPUT_LENGTH = 200;

export type LoginResult =
  | { ok: true; subcontName: string; password: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export interface LoginInput {
  subcontName: string;
  password: string;
  clientIp: string;
}

export interface LoginDeps {
  getDirectory: () => Promise<UserDirectory>;
  ipLimiter: SlidingWindowLimiter;
  nameLimiter: SlidingWindowLimiter;
}

/** Perbandingan waktu-konstan agar panjang/isi password tidak bocor lewat waktu respons. */
export function passwordMatches(input: string, stored: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(stored, "utf8").digest();
  return timingSafeEqual(a, b) && input === stored;
}

export async function attemptLogin(input: LoginInput, deps: LoginDeps): Promise<LoginResult> {
  const key = nameKey(input.subcontName);
  const ipKey = `ip:${input.clientIp}`;
  const nameLimitKey = `name:${key}`;

  const ipCheck = deps.ipLimiter.check(ipKey);
  const nameCheck = deps.nameLimiter.check(nameLimitKey);
  if (!ipCheck.allowed || !nameCheck.allowed) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.max(ipCheck.retryAfterSeconds, nameCheck.retryAfterSeconds),
    };
  }
  deps.ipLimiter.record(ipKey);

  const directory = await deps.getDirectory();
  const user = key ? directory.users.get(key) : undefined;

  // Tetap jalankan perbandingan walau user tidak ada, agar waktu respons serupa.
  const ok = passwordMatches(input.password, user?.password ?? "\u0000tidak-ada\u0000") && user !== undefined;

  if (!ok || !user) {
    deps.nameLimiter.record(nameLimitKey);
    return { ok: false, reason: "invalid" };
  }

  deps.nameLimiter.reset(nameLimitKey);
  return { ok: true, subcontName: collapseSpaces(user.name), password: user.password };
}

/** Validasi bentuk body permintaan login. */
export function parseLoginBody(body: unknown): { subcontName: string; password: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { subcontName, password } = body as Record<string, unknown>;
  if (typeof subcontName !== "string" || typeof password !== "string") return null;
  if (subcontName.length > MAX_INPUT_LENGTH || password.length > MAX_INPUT_LENGTH) return null;
  if (!collapseSpaces(subcontName) || password.length === 0) return null;
  return { subcontName, password };
}
