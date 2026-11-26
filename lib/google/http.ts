import { GoogleApiError } from "./errors";
import { getAccessToken } from "./oauth";

/**
 * fetch ke Google API dengan:
 * - header Authorization otomatis,
 * - refresh token sekali bila 401 (token dicabut/kedaluwarsa lebih awal),
 * - ulang otomatis dengan jeda bertahap untuk 429 dan 5xx.
 */

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 400;

export interface GoogleFetchOptions {
  fetchImpl?: typeof fetch;
  /** Hanya untuk test: jeda antar percobaan. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Jumlah ulang otomatis untuk 429/5xx/galat jaringan (bawaan 2).
   * Isi 0 untuk operasi tulis yang tidak boleh terulang (misalnya append baris).
   */
  maxRetries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function googleFetch(url: string, init: RequestInit = {}, options: GoogleFetchOptions = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  let refreshedAfter401 = false;
  let forceRefresh = false;

  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken({ forceRefresh, fetchImpl });
    forceRefresh = false;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers, cache: "no-store" });
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      throw new GoogleApiError(
        `Tidak dapat terhubung ke Google: ${err instanceof Error ? err.message : "galat jaringan"}`,
        0,
        "network",
      );
    }

    if (res.ok) return res;

    if (res.status === 401 && !refreshedAfter401) {
      refreshedAfter401 = true;
      forceRefresh = true;
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      await sleep(RETRY_BASE_MS * 2 ** attempt);
      continue;
    }

    throw await toGoogleError(res);
  }
}

async function toGoogleError(res: Response): Promise<GoogleApiError> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
  };
  const message = data.error?.message ?? `HTTP ${res.status}`;
  const code = data.error?.status ?? `http_${res.status}`;
  return new GoogleApiError(`Google API: ${message}`, res.status, code);
}
