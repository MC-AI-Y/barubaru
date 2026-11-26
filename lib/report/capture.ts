/**
 * Konteks pengambilan foto (dipanggil saat tombol potret ditekan):
 * waktu resmi server + lokasi berlapis + tanda tangan.
 * Hanya untuk kode server. Logika murni dengan dependensi yang bisa diganti saat test.
 */
import { collapseSpaces } from "../format/text";
import { resolveZone } from "../format/time";
import { CACHE_RADIUS_M, distanceMeters, formatCoordinates, type GeocodeResult } from "../geo/geocode";
import { signCapture, signTicket, verifyCapture, verifyTicket } from "./signature";
import type { CaptureContext } from "./types";

export interface CaptureRequest {
  lat: number;
  lon: number;
  acc: number;
  /** Selisih UTC perangkat dalam menit (misalnya 420 untuk WIB). */
  tzOffset: number | null;
  /** Konteks foto sebelumnya di laporan yang sama (cache per lokasi di perangkat). */
  reuse?: unknown;
  /** Hasil lapis 2 (BigDataCloud dari browser) beserta tiket dari respons pertama. */
  fallback?: { ticket: string; location: string; short: string; province: string | null };
}

export interface CaptureResponse {
  context: CaptureContext;
  /**
   * Ada bila lapis 1 gagal: browser boleh mencoba lapis 2 lalu mengirim ulang
   * dengan `fallback`. Bila lapis 2 juga gagal, `context` (koordinat) dipakai.
   */
  ticket?: string;
}

export function parseCaptureRequest(body: unknown): CaptureRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const lat = Number(b.lat);
  const lon = Number(b.lon);
  const acc = Number(b.acc ?? 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const tz = b.tzOffset === null || b.tzOffset === undefined ? null : Number(b.tzOffset);
  const req: CaptureRequest = {
    lat,
    lon,
    acc: Number.isFinite(acc) && acc >= 0 ? Math.min(acc, 100_000) : 0,
    tzOffset: tz !== null && Number.isFinite(tz) ? tz : null,
    reuse: b.reuse,
  };
  const f = b.fallback as Record<string, unknown> | undefined;
  if (f && typeof f === "object" && typeof f.ticket === "string" && typeof f.location === "string") {
    req.fallback = {
      ticket: f.ticket,
      location: collapseSpaces(f.location).slice(0, 300),
      short: collapseSpaces(typeof f.short === "string" ? f.short : f.location).slice(0, 120),
      province: typeof f.province === "string" ? f.province.slice(0, 80) : null,
    };
  }
  return req;
}

export interface CaptureDeps {
  subcont: string;
  secret: string;
  now: () => number;
  geocode: (lat: number, lon: number) => Promise<GeocodeResult | null>;
}

export async function createCaptureContext(req: CaptureRequest, deps: CaptureDeps): Promise<CaptureResponse> {
  const { subcont, secret } = deps;
  const coords = formatCoordinates(req.lat, req.lon);

  // Lapis 2: hasil BigDataCloud dari browser, waktu tetap dari tiket server.
  if (req.fallback) {
    const ticket = verifyTicket(req.fallback.ticket, subcont, secret, deps.now());
    if (ticket && req.fallback.location) {
      const zone = resolveZone({ province: req.fallback.province, lat: ticket.lat, lon: ticket.lon, deviceOffsetMinutes: req.tzOffset });
      return {
        context: signCapture(
          {
            t: ticket.t,
            zone,
            lat: ticket.lat,
            lon: ticket.lon,
            acc: ticket.acc,
            location: req.fallback.location,
            short: req.fallback.short || req.fallback.location,
            source: "bigdatacloud",
          },
          subcont,
          secret,
        ),
      };
    }
  }

  const t = deps.now();

  // Cache di perangkat: lokasi sama dengan foto sebelumnya (≤ 75 m) memakai alamat yang sama.
  if (
    verifyCapture(req.reuse, subcont, secret) &&
    req.reuse.source !== "coordinates" &&
    distanceMeters(req.lat, req.lon, req.reuse.lat, req.reuse.lon) <= CACHE_RADIUS_M
  ) {
    const r = req.reuse;
    return {
      context: signCapture(
        { t, zone: r.zone, lat: req.lat, lon: req.lon, acc: req.acc, location: r.location, short: r.short, source: r.source },
        subcont,
        secret,
      ),
    };
  }

  // Lapis 1: Nominatim (server).
  const geo = await deps.geocode(req.lat, req.lon).catch(() => null);
  if (geo) {
    const zone = resolveZone({ province: geo.province, lat: req.lat, lon: req.lon, deviceOffsetMinutes: req.tzOffset });
    return {
      context: signCapture(
        { t, zone, lat: req.lat, lon: req.lon, acc: req.acc, location: geo.location, short: geo.short, source: "nominatim" },
        subcont,
        secret,
      ),
    };
  }

  // Lapis 3: koordinat (selalu tersedia) + tiket agar browser bisa mencoba lapis 2.
  const zone = resolveZone({ lat: req.lat, lon: req.lon, deviceOffsetMinutes: req.tzOffset });
  return {
    context: signCapture(
      { t, zone, lat: req.lat, lon: req.lon, acc: req.acc, location: coords, short: coords, source: "coordinates" },
      subcont,
      secret,
    ),
    ticket: signTicket({ t, lat: req.lat, lon: req.lon, acc: req.acc, zone }, subcont, secret),
  };
}
