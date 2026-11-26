import { downloadDriveFile, getDriveFileMeta } from "@/lib/google/drive";
import { getActiveSession, jsonError, serverErrorResponse } from "@/lib/auth/server";
import { getVerifyFolders } from "@/lib/env";
import { nameKey } from "@/lib/format/text";
import { belongsTo } from "@/lib/orders/access";
import { parseKind } from "@/lib/orders/http";
import { loadVerifications } from "@/lib/verify/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menampilkan foto bukti verifikasi. Admin boleh melihat semua; subcont hanya fotonya sendiri.
 * Foto diambil lewat server sehingga folder Evidence tetap Restricted.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  const id = (url.searchParams.get("id") ?? "").toLowerCase();
  // which=pic → foto orang yang meminta verifikasi; selain itu foto evidence (barang / surat jalan).
  const wantPic = url.searchParams.get("which") === "pic";
  if (!kind || !/^[0-9a-f-]{36}$/.test(id)) return jsonError(400, "Permintaan tidak valid.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi.");

    let record = (await loadVerifications(kind)).find((r) => r.id === id);
    record ??= (await loadVerifications(kind, true)).find((r) => r.id === id);
    const fileId = record ? (wantPic ? record.picPhotoFileId : record.photoFileId) : "";
    if (!record || !fileId) return jsonError(404, "Foto tidak ditemukan.");
    const allowed =
      session.role === "admin" ||
      nameKey(record.submittedBy) === nameKey(session.subcontName) ||
      belongsTo(session.subcontName, record.subcont, record.subcontCity);
    if (!allowed) return jsonError(404, "Foto tidak ditemukan.");

    const meta = await getDriveFileMeta(fileId);
    const folders = getVerifyFolders(kind);
    if (!meta.parents?.some((p) => folders.includes(p)) || meta.mimeType !== "image/jpeg") return jsonError(404, "Foto tidak ditemukan.");
    const data = await downloadDriveFile(fileId);
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `inline; filename="${meta.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return serverErrorResponse(err, "Foto verifikasi");
  }
}
