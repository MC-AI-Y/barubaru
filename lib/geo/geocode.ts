/**
 * Reverse geocoding lapis 1 (server): OpenStreetMap Nominatim.
 *  - User-Agent + email kontak (aturan pemakaian Nominatim).
 *  - Maksimal 1 permintaan per detik per instance server.
 *  - Cache per lokasi (radius 75 m) di memori server.
 * Lapis 2 (BigDataCloud) dipanggil dari BROWSER karena layanan gratisnya
 * melarang pemanggilan dari server. Lapis 3 = koordinat.
 */

export interface GeocodeResult {
  /** Alamat lengkap (kolom Location). */
  location: string;
  /** Alamat singkat untuk watermark. */
  short: string;
  province: string | null;
}

export const CACHE_RADIUS_M = 75;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MIN_INTERVAL_MS = 1100;
const MAX_QUEUE_WAIT_MS = 2500;
const REQUEST_TIMEOUT_MS = 4000;

/** Jarak dua koordinat (meter). */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "lat, long" dengan 5 desimal (readme bagian 5). */
export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

interface NominatimAddress {
  [key: string]: string | undefined;
}

function uniqueJoin(parts: (string | undefined)[], max: number): string {
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length >= max) break;
  }
  return out.join(", ");
}

export function parseNominatim(data: { display_name?: string; address?: NominatimAddress }): GeocodeResult | null {
  const a = data.address ?? {};
  const full = (data.display_name ?? "").replace(/,\s*Indonesia\s*$/i, "").trim();
  if (!full) return null;
  const road = a.road ? (a.house_number ? `${a.road} No. ${a.house_number}` : a.road) : undefined;
  const short = uniqueJoin(
    [
      road,
      a.village ?? a.suburb ?? a.neighbourhood ?? a.hamlet ?? a.quarter,
      a.city_district ?? a.district ?? a.subdistrict,
      a.city ?? a.town ?? a.municipality ?? a.regency ?? a.county,
    ],
    3,
  );
  return { location: full.slice(0, 300), short: (short || full).slice(0, 120), province: a.state ?? a.province ?? null };
}

// ── Cache per lokasi ─────────────────────────────────────────

interface CacheEntry {
  lat: number;
  lon: number;
  at: number;
  result: GeocodeResult;
}

const cache: CacheEntry[] = [];

export function lookupCache(lat: number, lon: number, now = Date.now()): GeocodeResult | null {
  for (let i = cache.length - 1; i >= 0; i--) {
    const e = cache[i]!;
    if (now - e.at > CACHE_TTL_MS) {
      cache.splice(i, 1);
      continue;
    }
    if (distanceMeters(lat, lon, e.lat, e.lon) <= CACHE_RADIUS_M) return e.result;
  }
  return null;
}

export function storeCache(lat: number, lon: number, result: GeocodeResult, now = Date.now()): void {
  cache.push({ lat, lon, at: now, result });
  if (cache.length > CACHE_MAX) cache.splice(0, cache.length - CACHE_MAX);
}

// ── Pembatas 1 permintaan/detik ──────────────────────────────

let nextSlot = 0;

/** Mengambil giliran; null bila antrean terlalu panjang (langsung ke lapis berikutnya). */
async function takeSlot(): Promise<boolean> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  if (start - now > MAX_QUEUE_WAIT_MS) return false;
  nextSlot = start + MIN_INTERVAL_MS;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
  return true;
}

export async function reverseGeocodeNominatim(
  lat: number,
  lon: number,
  contactEmail: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeResult | null> {
  const cached = lookupCache(lat, lon);
  if (cached) return cached;
  if (!(await takeSlot())) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "id",
    email: contactEmail,
  }).toString();

  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": `WHControl/1.0 (YOFC warehouse control; ${contactEmail})`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const result = parseNominatim((await res.json()) as { display_name?: string; address?: NominatimAddress });
    if (result) storeCache(lat, lon, result);
    return result;
  } catch {
    return null;
  }
}
