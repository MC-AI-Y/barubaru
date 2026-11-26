/**
 * Cache sederhana di memori server dengan masa berlaku (TTL).
 *
 * - Permintaan bersamaan berbagi satu proses pengambilan.
 * - Bila pengambilan ulang gagal tetapi masih ada data lama, data lama dipakai
 *   (maksimal `staleMaxMs`) agar login tidak ikut gagal saat Google sesaat bermasalah.
 * - Di Vercel, setiap instance server punya cache sendiri (sesuai keputusan #24).
 */

export interface TtlCacheOptions {
  ttlMs: number;
  /** Batas umur data lama yang masih boleh dipakai saat pengambilan gagal. */
  staleMaxMs?: number;
  now?: () => number;
  onStaleServed?: (error: unknown) => void;
}

export interface TtlCache<T> {
  get: () => Promise<T>;
  invalidate: () => void;
}

export function createTtlCache<T>(loader: () => Promise<T>, options: TtlCacheOptions): TtlCache<T> {
  const { ttlMs, staleMaxMs = 60 * 60 * 1000, now = Date.now, onStaleServed } = options;
  let entry: { value: T; loadedAt: number } | null = null;
  let inflight: Promise<T> | null = null;

  async function load(): Promise<T> {
    try {
      const value = await loader();
      entry = { value, loadedAt: now() };
      return value;
    } catch (error) {
      if (entry && now() - entry.loadedAt <= staleMaxMs) {
        onStaleServed?.(error);
        return entry.value;
      }
      throw error;
    }
  }

  return {
    get() {
      if (entry && now() - entry.loadedAt < ttlMs) return Promise.resolve(entry.value);
      if (!inflight) {
        inflight = load().finally(() => {
          inflight = null;
        });
      }
      return inflight;
    },
    invalidate() {
      entry = null;
    },
  };
}
