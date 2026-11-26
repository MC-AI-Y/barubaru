import { getDriveFolders } from "@/lib/env";
import { nameKey } from "@/lib/format/text";
import { downloadDriveFile, getDriveFileMeta } from "@/lib/google/drive";
import { getActiveSession, rejectIfNotSubcont, jsonError, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

/** Unduh PDF Form Material Stock milik akun yang sedang login. */
export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;

    const fileId = new URL(request.url).searchParams.get("file") ?? "";
    if (!FILE_ID_RE.test(fileId)) return jsonError(400, "Permintaan tidak valid.");

    const meta = await getDriveFileMeta(fileId);
    const owner = meta.appProperties?.whcSub;
    const inFormFolder = meta.parents?.includes(getDriveFolders().form) ?? false;
    if (!inFormFolder || owner !== nameKey(session.subcontName).slice(0, 80) || meta.mimeType !== "application/pdf") {
      return jsonError(404, "PDF tidak ditemukan.");
    }

    const data = await downloadDriveFile(fileId);
    const safeName = meta.name.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return serverErrorResponse(err, "Unduh PDF");
  }
}
