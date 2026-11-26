import { NextResponse } from "next/server";
import { getActiveSession, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";
import { ownedBy, rankCities } from "@/lib/dashboard/compute";
import { loadDashboard } from "@/lib/dashboard/store";
import type { DashboardResponse, PendingCounts } from "@/lib/dashboard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hasil hitung stok SMDT untuk Dashboard (spesifikasi v5.0 bagian 4).
 * Admin melihat semua Subcont City; subcont hanya miliknya. Query: refresh=1 untuk data terbaru.
 */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const data = await loadDashboard(refresh);
    const isAdmin = session.role === "admin";
    const mine = (subcont: string, subcontCity: string) => isAdmin || ownedBy(session.subcontName, subcont, subcontCity);

    const pending: PendingCounts = { do: 0, to: 0, boq: 0 };
    for (const p of data.result.pendingByCity.values()) {
      if (!mine(p.subcont, p.subcontCity)) continue;
      pending.do += p.do;
      pending.to += p.to;
      pending.boq += p.boq;
    }
    const body: DashboardResponse = {
      rows: data.result.rows.filter((r) => mine(r.subcont, r.subcontCity)),
      visits: data.result.visits.filter((v) => mine(v.subcont, v.subcontCity)),
      pending,
      ranking: isAdmin ? rankCities(data.result).slice(0, 50) : null,
      multiCityVisits: isAdmin ? data.multiCityVisits : 0,
      warnings: data.warnings,
      computedAt: data.computedAt,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Dashboard");
  }
}
