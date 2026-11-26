import { NextResponse } from "next/server";
import { getActiveSession, jsonError, NO_STORE } from "@/lib/auth/server";
import { buildDocuments, needsAction } from "@/lib/orders/access";
import { explainOrdersError, loadOrders } from "@/lib/orders/store";
import { loadHistory } from "@/lib/orders/http";
import { ORDER_KINDS, type OrderCountsResponse, type OrderKind } from "@/lib/orders/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jumlah dokumen yang perlu diverifikasi akun ini, untuk Beranda.
 * Database yang gagal dibaca bernilai null + pesan di `errors` agar Beranda
 * memberi tahu (bukan diam-diam kosong seperti v5.1).
 */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    const entries = await Promise.all(
      ORDER_KINDS.map(async (kind): Promise<[OrderKind, number | null, string | null]> => {
        try {
          const [data, hist] = await Promise.all([loadOrders(kind), loadHistory(kind)]);
          const docs = buildDocuments(kind, data, session, hist.history);
          let n = 0;
          for (const d of docs.values()) if (needsAction(d.summary)) n++;
          return [kind, n, null];
        } catch (err) {
          console.error(`[WHControl] Jumlah ${kind.toUpperCase()} gagal dihitung:`, err instanceof Error ? err.message : "");
          return [kind, null, explainOrdersError(kind, err) ?? `Database ${kind.toUpperCase()} sementara tidak bisa dibaca. Coba lagi beberapa saat lagi.`];
        }
      }),
    );
    const errors: Partial<Record<OrderKind, string>> = {};
    for (const [kind, , message] of entries) if (message) errors[kind] = message;
    const body: OrderCountsResponse = {
      counts: Object.fromEntries(entries.map(([k, n]) => [k, n])) as Record<OrderKind, number | null>,
      errors,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch {
    return jsonError(503, "Layanan sedang bermasalah. Coba lagi beberapa saat lagi.");
  }
}
