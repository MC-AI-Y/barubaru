import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/env";
import { GoogleApiError } from "@/lib/google/errors";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";
import { loadDashboard, writeSmdt } from "@/lib/dashboard/store";
import type { SmdtSyncResponse } from "@/lib/dashboard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Admin: tulis ulang sheet SMDT → Stock dari hasil hitung terbaru (spesifikasi v5.0 bagian 4.2). */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi.");
    if (session.role !== "admin") return jsonError(403, "Hanya admin yang bisa memperbarui SMDT.");
    const data = await loadDashboard(true);
    const res = await writeSmdt(data.result);
    const body: SmdtSyncResponse = { written: res.written, remarksKept: res.remarksKept, computedAt: data.computedAt };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ConfigError) {
      serverErrorResponse(err, "SMDT");
      return jsonError(503, "Sheet SMDT belum diatur di server (SHEET_SMDT_ID / SHEET_SMDT_TAB).");
    }
    if (err instanceof GoogleApiError && [400, 403, 404].includes(err.status)) {
      serverErrorResponse(err, "SMDT");
      return jsonError(503, "Sheet SMDT tidak bisa dibuka atau ditulis oleh akun WHControl. Periksa ID, nama tab, dan akses edit.");
    }
    return serverErrorResponse(err, "SMDT");
  }
}
