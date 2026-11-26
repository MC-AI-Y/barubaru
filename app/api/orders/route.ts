import { NextResponse } from "next/server";
import { getActiveSession, jsonError, NO_STORE } from "@/lib/auth/server";
import { buildDocuments, listDocuments, wibDayStart } from "@/lib/orders/access";
import { loadHistory, ordersErrorResponse, parseKind, parsePage, parseView } from "@/lib/orders/http";
import { invalidateOrders, loadOrders } from "@/lib/orders/store";
import type { OrderListResponse } from "@/lib/orders/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * Daftar dokumen DO/TO/BOQ untuk akun yang login (spesifikasi v5.0 bagian 5–6).
 * Query: kind=do|to|boq, view=todo|waiting|verified|all, q=teks, region=nama, subcont=nama (admin), from/to=YYYY-MM-DD, page=1, refresh=1.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  if (!kind) return jsonError(400, "Jenis dokumen tidak dikenal.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");

    const refresh = url.searchParams.get("refresh") === "1";
    if (refresh) invalidateOrders(kind);
    const [data, hist] = await Promise.all([loadOrders(kind), loadHistory(kind, refresh)]);
    const docs = buildDocuments(kind, data, session, hist.history);
    const isAdmin = session.role === "admin";
    const page = parsePage(url.searchParams.get("page"));
    const view = parseView(url.searchParams.get("view"));
    const result = listDocuments(docs, {
      view,
      q: (url.searchParams.get("q") ?? "").slice(0, 100),
      subcont: isAdmin ? (url.searchParams.get("subcont") ?? "").slice(0, 200) : "",
      region: (url.searchParams.get("region") ?? "").slice(0, 100),
      page,
      pageSize: PAGE_SIZE,
      from: wibDayStart(url.searchParams.get("from")) ?? undefined,
      to: ((d) => (d === null ? undefined : d + 24 * 60 * 60 * 1000))(wibDayStart(url.searchParams.get("to"))),
    });
    const body: OrderListResponse = {
      kind,
      view,
      items: result.items,
      total: result.total,
      page,
      pageSize: PAGE_SIZE,
      kpi: result.kpi,
      regions: result.regions,
      subconts: isAdmin ? result.subconts : null,
      updatedAt: data.loadedAt,
      verifyWarning: hist.warning,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    return ordersErrorResponse(kind, err);
  }
}
