import { NextResponse } from "next/server";
import { getMaterialOptions } from "@/lib/google/database";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar material beserta remark-nya (sama untuk semua akun, keputusan #19).
 * Material tanpa remark mengembalikan remarks: ["-"].
 */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;

    const materials = await getMaterialOptions();
    return NextResponse.json({ materials }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Referensi material");
  }
}
