/**
 * Pembatas percobaan login di memori server (keputusan #24: tanpa penyimpanan eksternal).
 *
 * Sifatnya *best effort*: berlaku per instance server Vercel. Tetap efektif
 * memperlambat tebakan password karena dikombinasikan dengan jeda setiap gagal.
 */

export interface RateLimitRule {
  /** Jumlah maksimal kejadian dalam jendela waktu. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Detik sampai boleh mencoba lagi (bila ditolak). */
  retryAfterSeconds: number;
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(
    private readonly rule: RateLimitRule,
    options: { maxKeys?: number; now?: () => number } = {},
  ) {
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.rule.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }

  /** Memeriksa tanpa mencatat. */
  check(key: string): RateLimitResult {
    const list = this.recent(key);
    if (list.length < this.rule.limit) return { allowed: true, retryAfterSeconds: 0 };
    const oldest = list[0] ?? this.now();
    const retryMs = oldest + this.rule.windowMs - this.now();
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)) };
  }

  /** Mencatat satu kejadian. */
  record(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    if (this.hits.size > this.maxKeys) this.prune();
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(): void {
    for (const key of [...this.hits.keys()]) this.recent(key);
    // Bila masih terlalu banyak, buang kunci tertua agar memori tetap kecil.
    while (this.hits.size > this.maxKeys) {
      const first = this.hits.keys().next().value;
      if (first === undefined) break;
      this.hits.delete(first);
    }
  }
}

const FIFTEEN_MIN = 15 * 60 * 1000;

/** Per alamat IP: semua percobaan login (berhasil maupun gagal). */
export const loginIpLimiter = new SlidingWindowLimiter({ limit: 20, windowMs: FIFTEEN_MIN });

/** Per Subcont Name: percobaan GAGAL. Direset setelah login berhasil. */
export const loginNameLimiter = new SlidingWindowLimiter({ limit: 5, windowMs: FIFTEEN_MIN });

/** Per akun subcont: pengiriman verifikasi DO/TO/BOQ (cegah unggah beruntun). */
export const verifyLimiter = new SlidingWindowLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

/** Per akun admin: keputusan setujui/tolak. */
export const decideLimiter = new SlidingWindowLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });
