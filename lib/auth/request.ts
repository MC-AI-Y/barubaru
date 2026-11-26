/**
 * Utilitas permintaan HTTP untuk route API (tanpa import Next.js agar bisa diuji).
 */

/** IP klien dari header proxy Vercel. Hanya dipakai untuk rate limit. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Menolak permintaan POST dari situs lain (perlindungan CSRF tambahan selain
 * cookie SameSite=Lax). Bila header Origin ada, host-nya harus sama.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // Beberapa browser lama tidak mengirim Origin untuk same-origin.
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Membaca nilai satu cookie dari header Cookie. */
export function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      const value = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}
