import { NextResponse } from "next/server";
import { getGeocodeContactEmail, getJwtSecret } from "@/lib/env";
import { reverseGeocodeNominatim } from "@/lib/geo/geocode";
import { createCaptureContext, parseCaptureRequest } from "@/lib/report/capture";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dipanggil saat tombol potret ditekan: waktu resmi server + lokasi (Nominatim,
 * cache per lokasi) + tanda tangan. Tombol potret di browser menunggu respons ini.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi. Draf Anda tetap aman.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;

    const req = parseCaptureRequest(await request.json().catch(() => null));
    if (!req) return jsonError(400, "Koordinat GPS tidak valid. Aktifkan lokasi lalu coba lagi.");

    const email = getGeocodeContactEmail();
    const result = await createCaptureContext(req, {
      subcont: session.subcontName,
      secret: getJwtSecret(),
      now: Date.now,
      geocode: (lat, lon) => reverseGeocodeNominatim(lat, lon, email),
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Konteks foto");
  }
}
