import { NextResponse } from "next/server";
import { toDisplayCity } from "@/lib/format/city";
import { nameKey } from "@/lib/format/text";
import { getRegionMap } from "@/lib/google/database";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar kota milik akun yang login. Difilter di SERVER berdasarkan sesi,
 * sehingga akun tidak bisa melihat kota subcont lain.
 * value = nilai asli database (huruf kapital), label = tampilan (huruf awal kapital).
 */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;

    const regions = await getRegionMap();
    const cities = (regions.get(nameKey(session.subcontName)) ?? []).map((city) => ({
      value: city,
      label: toDisplayCity(city),
    }));
    return NextResponse.json({ cities }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Referensi kota");
  }
}
