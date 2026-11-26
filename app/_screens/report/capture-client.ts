/**
 * Meminta konteks foto ke server saat tombol potret ditekan.
 * Lapis 1 (Nominatim) di server. Bila gagal, lapis 2 (BigDataCloud) dipanggil
 * dari BROWSER, sesuai aturan layanan gratisnya, lalu hasilnya ditandatangani server.
 * Lapis 3 (koordinat) selalu tersedia, sehingga foto tidak pernah gagal karena alamat.
 */
import type { CaptureContext } from "@/lib/report/types";
import type { GeoFix } from "@/components/camera/useGeolocation";

export class UnauthorizedError extends Error {
  constructor() {
    super("Sesi berakhir. Silakan login lagi. Draf Anda tetap aman.");
    this.name = "UnauthorizedError";
  }
}

const NO_SERVER =
  "Tidak dapat menghubungi server. Waktu resmi dari server diperlukan untuk memotret. Periksa sinyal lalu coba lagi.";

async function postContext(body: unknown): Promise<{ context: CaptureContext; ticket?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/capture/context", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(NO_SERVER);
  }
  if (res.status === 401) throw new UnauthorizedError();
  const data = (await res.json().catch(() => null)) as ({ context: CaptureContext; ticket?: string } & { error?: string }) | null;
  if (!res.ok || !data?.context) throw new Error(data?.error ?? NO_SERVER);
  return data;
}

interface BdcResult {
  location: string;
  short: string;
  province: string | null;
}

async function bigDataCloud(lat: number, lon: number): Promise<BdcResult | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string };
    const parts = [d.locality, d.city, d.principalSubdivision].filter((p): p is string => Boolean(p && p.trim()));
    const unique = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
    if (unique.length === 0) return null;
    return { location: unique.join(", "), short: unique.slice(0, 2).join(", "), province: d.principalSubdivision ?? null };
  } catch {
    return null;
  }
}

export async function requestCaptureContext(fix: GeoFix, reuse?: CaptureContext | null): Promise<CaptureContext> {
  const base = { lat: fix.lat, lon: fix.lon, acc: fix.acc, tzOffset: -new Date().getTimezoneOffset() };
  const first = await postContext({ ...base, reuse: reuse ?? undefined });
  if (!first.ticket) return first.context;

  const bdc = await bigDataCloud(fix.lat, fix.lon);
  if (!bdc) return first.context;
  try {
    const second = await postContext({ ...base, fallback: { ticket: first.ticket, ...bdc } });
    return second.context;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    return first.context;
  }
}
