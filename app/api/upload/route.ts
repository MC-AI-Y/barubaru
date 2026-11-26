import { NextResponse } from "next/server";
import { getDriveFolders, getJwtSecret } from "@/lib/env";
import { photoFileName, type PhotoKind } from "@/lib/format/filename";
import { nameKey } from "@/lib/format/text";
import { driveViewLink, findDriveFileByKey, uploadDriveFile } from "@/lib/google/drive";
import { signUpload, verifyCapture } from "@/lib/report/signature";
import { LIMITS } from "@/lib/report/types";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const KINDS: readonly PhotoKind[] = ["PAO", "PAC", "MATERIAL"];

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Unggah SATU foto (sudah dikompres di perangkat, < 4 MB) ke folder Drive yang sesuai.
 * Idempoten: foto yang sama (photoId) tidak pernah tersimpan dua kali.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi. Draf Anda tetap aman.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;
    const secret = getJwtSecret();

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const metaRaw = form?.get("meta");
    if (!(file instanceof Blob) || typeof metaRaw !== "string") return jsonError(400, "Data unggahan tidak lengkap.");

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(metaRaw) as Record<string, unknown>;
    } catch {
      return jsonError(400, "Data unggahan tidak valid.");
    }
    const submissionId = String(meta.submissionId ?? "").toLowerCase();
    const kind = meta.kind as PhotoKind;
    const photoId = String(meta.photoId ?? "");
    const index = Number(meta.index ?? 1);
    if (!UUID_RE.test(submissionId) || !KINDS.includes(kind) || !PHOTO_ID_RE.test(photoId) || !Number.isInteger(index) || index < 1 || index > LIMITS.materialsMax) {
      return jsonError(400, "Data unggahan tidak valid.");
    }
    const capture = meta.capture;
    if (!verifyCapture(capture, session.subcontName, secret)) {
      return jsonError(422, "Data waktu/lokasi foto tidak sah. Ambil ulang foto tersebut.");
    }
    if (file.size === 0 || file.size > LIMITS.photoMaxBytes) return jsonError(413, "Ukuran foto terlalu besar.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isJpeg(bytes)) return jsonError(415, "Format foto harus JPEG.");

    const folders = getDriveFolders();
    const folderId = kind === "PAO" ? folders.pao : kind === "PAC" ? folders.pac : folders.evidence;
    const key = `${submissionId}:${kind}:${photoId}`;

    let saved = await findDriveFileByKey(folderId, key);
    if (!saved) {
      saved = await uploadDriveFile({
        folderId,
        name: photoFileName({
          kind,
          subcontName: session.subcontName,
          capturedAt: capture.t,
          zone: capture.zone,
          material: typeof meta.material === "string" ? meta.material.slice(0, 120) : "",
          index,
        }),
        mimeType: "image/jpeg",
        data: bytes,
        appProperties: { whcKey: key, whcSid: submissionId, whcSub: nameKey(session.subcontName).slice(0, 80) },
      });
    }

    const receipt = signUpload({ submissionId, kind, photoId, fileId: saved.id }, session.subcontName, secret);
    return NextResponse.json({ fileId: saved.id, link: driveViewLink(saved), receipt }, { headers: NO_STORE });
  } catch (err) {
    return serverErrorResponse(err, "Unggah foto");
  }
}
