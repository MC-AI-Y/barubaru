import { NextResponse } from "next/server";
import { getActiveSession, jsonError, NO_STORE } from "@/lib/auth/server";
import { buildDocuments } from "@/lib/orders/access";
import { loadHistory, ordersErrorResponse, parseKind } from "@/lib/orders/http";
import { loadOrders } from "@/lib/orders/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Detail satu dokumen (semua baris material). Hanya dokumen yang boleh dilihat akun ini. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  const key = url.searchParams.get("key") ?? "";
  if (!kind || !key || key.length > 600) return jsonError(400, "Dokumen tidak dikenal.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir. Silakan login.");
    const [data, hist] = await Promise.all([loadOrders(kind), loadHistory(kind)]);
    const docs = buildDocuments(kind, data, session, hist.history);
    const detail = docs.get(key);
    if (!detail) return jsonError(404, "Dokumen tidak ditemukan atau bukan milik akun ini.");
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (err) {
    return ordersErrorResponse(kind, err);
  }
}
