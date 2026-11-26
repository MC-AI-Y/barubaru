import { NextResponse } from "next/server";
import { getActiveSession, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mengecek sesi yang tersimpan di cookie (dipakai saat aplikasi dibuka ulang). */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    return NextResponse.json(
      { subcontName: session.subcontName, role: session.role, expiresAt: session.claims.exp * 1000 },
      { headers: NO_STORE },
    );
  } catch (err) {
    return serverErrorResponse(err, "Cek sesi");
  }
}
