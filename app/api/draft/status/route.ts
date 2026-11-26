import { NextResponse } from "next/server";
import { nameKey } from "@/lib/format/text";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";
import { deviceLabel, parseDraftStatusInput, visibleDraftStatuses } from "@/lib/report/draft-status";
import { listDraftStatuses, removeDraftStatus, upsertDraftStatus } from "@/lib/report/draft-status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/;
const SESSION_EXPIRED = "Sesi berakhir. Silakan login lagi. Draf Anda tetap aman.";

function subKeyOf(subcontName: string): string {
  return nameKey(subcontName).slice(0, 80);
}

/**
 * Daftar laporan yang belum terkirim di PERANGKAT LAIN untuk akun yang login.
 * Query: deviceId (perangkat ini), local (Submission ID draf di perangkat ini, opsional).
 */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, SESSION_EXPIRED);
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId") ?? "";
    const local = (url.searchParams.get("local") ?? "").toLowerCase();
    if (!DEVICE_RE.test(deviceId)) return jsonError(400, "Data perangkat tidak valid.");

    const all = await listDraftStatuses(subKeyOf(session.subcontName));
    const drafts = visibleDraftStatuses(all, { deviceId, localSubmissionId: UUID_RE.test(local) ? local : null, now: Date.now() }).map(
      ({ deviceId: _ignored, ...rest }) => rest,
    );
    return NextResponse.json({ drafts }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Status draf (baca)");
  }
}

/** Perangkat melaporkan ringkasan draf yang sedang dikerjakan. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, SESSION_EXPIRED);
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;
    const now = Date.now();
    const input = parseDraftStatusInput(await request.json().catch(() => null), now);
    if (!input) return jsonError(400, "Data draf tidak valid.");
    await upsertDraftStatus(input, {
      subKey: subKeyOf(session.subcontName),
      device: deviceLabel(request.headers.get("user-agent")),
      now,
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Status draf (simpan)");
  }
}

/** Hapus ringkasan draf (draf dibuang, atau pemberitahuan dihapus pengguna). */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, SESSION_EXPIRED);
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;
    const body = (await request.json().catch(() => null)) as { submissionId?: unknown } | null;
    const submissionId = String(body?.submissionId ?? "").toLowerCase();
    if (!UUID_RE.test(submissionId)) return jsonError(400, "Data draf tidak valid.");
    await removeDraftStatus(submissionId, subKeyOf(session.subcontName));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Status draf (hapus)");
  }
}
