import { NextResponse } from "next/server";
import { formatDateTime } from "@/lib/format/time";
import { cellText } from "@/lib/format/text";
import { isSameOrigin } from "@/lib/auth/request";
import { decideLimiter } from "@/lib/auth/rate-limit";
import { getActiveSession, jsonError, NO_STORE } from "@/lib/auth/server";
import { syncSmdtAfterChange } from "@/lib/dashboard/sync";
import { buildDocuments } from "@/lib/orders/access";
import { loadHistory, ordersErrorResponse, parseKind } from "@/lib/orders/http";
import { invalidateOrders, loadOrders } from "@/lib/orders/store";
import { approvedValue, needsAdminDecision, STATUS_VALUES } from "@/lib/orders/status";
import { writeDocumentCells } from "@/lib/orders/write";
import { STATUS_PENDING, STATUS_REJECTED, STATUS_VERIFIED } from "@/lib/verify/records";
import { updateVerification } from "@/lib/verify/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin menyetujui atau menolak verifikasi subcont DO/TO (v5.3).
 * Setujui: kolom Verified di sheet asli = APPROVED, catatan diperbarui, SMDT ditulis ulang.
 * Tolak: kolom Verified = NEED CHECK, alasan disimpan di catatan Verifikasi; dokumen kembali ke subcont.
 * BOQ tidak melewati admin: subcont langsung memilih APD/ABD/RFSC/FO CUT/VANDALISME.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = parseKind(typeof body?.kind === "string" ? body.kind : null);
  const key = typeof body?.key === "string" ? body.key : "";
  // verificationId opsional: status bisa diisi RECEIVED manual di sheet tanpa catatan di aplikasi.
  const verificationId = String(body?.verificationId ?? "").toLowerCase();
  const decision = body?.decision;
  const reason = cellText(typeof body?.reason === "string" ? body.reason : "").slice(0, 300);
  if (!kind || !key || key.length > 600 || (verificationId && !UUID_RE.test(verificationId)) || (decision !== "approve" && decision !== "reject")) {
    return jsonError(400, "Data keputusan tidak valid.");
  }
  if (!needsAdminDecision(kind)) return jsonError(400, "BOQ tidak perlu keputusan admin. Status BOQ dipilih subcont saat verifikasi.");
  if (decision === "reject" && reason.length < 3) return jsonError(422, "Tulis alasan penolakan (minimal 3 karakter).");

  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi.");
    if (session.role !== "admin") return jsonError(403, "Hanya admin yang bisa menyetujui atau menolak verifikasi.");
    const limit = decideLimiter.check(session.subcontName);
    if (!limit.allowed) return jsonError(429, `Terlalu banyak keputusan dalam waktu singkat. Coba lagi dalam ${limit.retryAfterSeconds} detik.`);
    decideLimiter.record(session.subcontName);

    // Data terbaru dari sheet asli dan spreadsheet Verifikasi.
    invalidateOrders(kind);
    const [data, hist] = await Promise.all([loadOrders(kind), loadHistory(kind, true)]);
    if (hist.warning) return jsonError(503, "Spreadsheet Verifikasi sedang tidak bisa dibuka. Coba lagi beberapa saat lagi.");
    const doc = buildDocuments(kind, data, session, hist.history).get(key);
    if (!doc) return jsonError(404, "Dokumen tidak ditemukan. Mungkin sudah diubah di sheet; tekan Muat ulang.");
    const s = doc.summary;
    if (s.status !== "pending") return jsonError(409, `Dokumen ini tidak sedang menunggu admin (status: ${s.statusLabel || "kosong"}). Tekan Muat ulang.`);
    const pendingLog = s.latest?.status === STATUS_PENDING ? s.latest : null;
    if (verificationId && pendingLog && pendingLog.id !== verificationId) {
      return jsonError(409, "Verifikasi ini sudah dikirim ulang oleh subcont. Tekan Muat ulang.");
    }

    const now = Date.now();
    const reviewed = { reviewedAt: now, reviewedText: formatDateTime(now, "WIB"), reviewedBy: session.subcontName };

    const rows = [...doc.transferLines.map((l) => l.row), ...doc.boqLines.map((l) => l.row)];
    const values = STATUS_VALUES[kind];

    if (decision === "reject") {
      await writeDocumentCells(kind, rows, { verified: values.rejected ?? "" });
      invalidateOrders(kind);
      if (pendingLog) await updateVerification(kind, pendingLog.id, { status: STATUS_REJECTED, rejectReason: reason, ...reviewed });
      return NextResponse.json({ ok: true, status: "rejected", statusLabel: values.rejected }, { headers: NO_STORE });
    }

    const approved = approvedValue(kind);
    await writeDocumentCells(kind, rows, { verified: approved });
    invalidateOrders(kind);
    if (pendingLog) await updateVerification(kind, pendingLog.id, { status: STATUS_VERIFIED, rejectReason: "", ...reviewed });

    // SMDT ditulis ulang setelah setiap persetujuan (bagian 4.2). Gagal di sini tidak membatalkan persetujuan.
    const smdt = await syncSmdtAfterChange();
    return NextResponse.json({ ok: true, status: "verified", statusLabel: approved, rows: rows.length, smdt }, { headers: NO_STORE });
  } catch (err) {
    return ordersErrorResponse(kind, err);
  }
}
