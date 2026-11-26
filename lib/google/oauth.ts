import { getGoogleOAuthConfig } from "../env";
import { GoogleApiError } from "./errors";

/**
 * Access token Google dari refresh token akun khusus WHControl (readme bagian 10, Jalur A).
 * Token disimpan di memori server dan diperbarui 60 detik sebelum habis.
 */

export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Scope yang diminta saat membuat refresh token (lihat scripts/get-refresh-token.mjs). */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

const EARLY_REFRESH_MS = 60_000;

async function requestAccessToken(fetchImpl: typeof fetch): Promise<CachedToken> {
  const { clientId, clientSecret, refreshToken } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    const code = data.error ?? `http_${res.status}`;
    throw new GoogleApiError(`Gagal memperbarui access token Google (${code}).`, res.status, code);
  }

  const lifetimeMs = (data.expires_in ?? 3600) * 1000;
  return { value: data.access_token, expiresAt: Date.now() + lifetimeMs };
}

/**
 * Mengembalikan access token yang masih berlaku.
 * Permintaan bersamaan berbagi satu proses refresh.
 */
export async function getAccessToken(options: { forceRefresh?: boolean; fetchImpl?: typeof fetch } = {}): Promise<string> {
  const { forceRefresh = false, fetchImpl = fetch } = options;

  if (!forceRefresh && cached && cached.expiresAt - EARLY_REFRESH_MS > Date.now()) {
    return cached.value;
  }
  if (inflight) return inflight;

  inflight = requestAccessToken(fetchImpl)
    .then((token) => {
      cached = token;
      return token.value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Hanya untuk test. */
export function resetAccessTokenCache(): void {
  cached = null;
  inflight = null;
}
