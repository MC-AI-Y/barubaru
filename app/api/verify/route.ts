import { NextResponse } from "next/server";
import { getEvidenceFolder, getJwtSecret, getPicFolder } from "@/lib/env";
import { verifyPhotoFileName } from "@/lib/format/filename";
import { formatDateTime } from "@/lib/format/time";
import { cellText, nameKey } from "@/lib/format/text";
import { findDriveFileByKey, uploadDriveFile } from "@/lib/google/drive";
import { buildDocuments } from "@/lib/orders/access";
import { loadHistory, ordersErrorResponse, parseKind } from "@/lib/orders/http";
import { invalidateOrders, loadOrders } from "@/lib/orders/store";
import { normalizeBoqChoice, STATUS_VALUES } from "@/lib/orders/status";
import { syncSmdtAfterChange } from "@/lib/dashboard/sync";
import { normalizePhone, picCell } from "@/lib/verify/pic";
import { writeDocumentCells } from "@/lib/orders/write";
import { verifyCapture } from "@/lib/report/signature";
import { LIMITS, type CaptureContext } from "@/lib/report/types";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, jsonError, NO_STORE, rejectIfNotSubcont } from "@/lib/auth/server";
import { verifyLimiter } from "@/lib/auth/rate-limit";
import { STATUS_PENDING, STATUS_VERIFIED } from "@/lib/verify/records";
import { appendVerification } from "@/lib/verify/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Foto bukti harus diambil paling lama 30 menit sebelum dikirim. */
const MAX_PHOTO_AGE_MS = 30 * 60 * 1000;

type PhotoCheck = { ok: true; bytes: Uint8Array; capture: CaptureContext } | { ok: false; status: number; message: string };

/** Foto wajib JPEG dari kamera aplikasi: waktu/lokasi resmi dari server (watermark) harus sah dan segar. */
async function checkPhoto(file: FormDataEntryValue | null | undefined, capture: unknown, subcont: string, label: string): Promise<PhotoCheck> {
  if (!(file instanceof Blob)) return { ok: false, status: 400, message: `${label} belum diambil.` };
  if (!verifyCapture(capture, subcont, getJwtSecret())) {
    return { ok: false, status: 422, message: `${label} harus diambil langsung dari kamera aplikasi. Ambil ulang foto.` };
  }
  if (Date.now() - capture.t > MAX_PHOTO_AGE_MS) return { ok: false, status: 422, message: `${label} sudah lebih dari 30 menit. Ambil ulang foto.` };
  if (file.size === 0 || file.size > LIMITS.photoMaxBytes) return { ok: false, status: 413, message: `Ukuran ${label.toLowerCase()} terlalu besar.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return { ok: false, status: 415, message: `Format ${label.toLowerCase()} harus JPEG.` };
  return { ok: true, bytes, capture };
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Subcont mengirim verifikasi DO/TO/BOQ (revisi 26 Nov 2026):
 * 2 foto langsung dari KAMERA, berwatermark, untuk seluruh dokumen:
 *   - Photo Evidence     = barang / surat jalan → folder Evidence DO/TO/BOQ
 *   - Photo Evidence PIC = orang yang meminta verifikasi → folder Photo PIC DO/TO/BOQ
 * + nama dan nomor telepon PIC. Sheet asli diisi: PIC Name, Photo Evidence PIC, Photo Evidence, Verified = RECEIVED (DO/TO) atau pilihan subcont APD/ABD/RFSC/FO CUT/VANDALISME (BOQ).
 * Idempoten per verificationId: kirim ulang setelah koneksi putus tidak membuat data ganda.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const filePic = form?.get("filePic");
  const metaRaw = form?.get("meta");
  if (typeof metaRaw !== "string") return jsonError(400, "Data verifikasi tidak lengkap.");
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaRaw) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Data verifikasi tidak valid.");
  }
  const kind = parseKind(typeof meta.kind === "string" ? meta.kind : null);
  const key = typeof meta.key === "string" ? meta.key : "";
  const verificationId = String(meta.verificationId ?? "").toLowerCase();
  const notes = cellText(typeof meta.notes === "string" ? meta.notes : "").slice(0, 500);
  const picName = cellText(typeof meta.picName === "string" ? meta.picName : "").slice(0, 80);
  const picPhone = normalizePhone(typeof meta.picPhone === "string" ? meta.picPhone : "");
  if (!kind || !key || key.length > 600 || !UUID_RE.test(verificationId)) return jsonError(400, "Data verifikasi tidak valid.");
  if (picName.length < 2) return jsonError(422, "Isi nama PIC yang meminta verifikasi.");
  // BOQ (v5.3): subcont memilih isi kolom Verified: APD, ABD, RFSC, atau FO CUT/VANDALISME.
  const boqChoice = kind === "boq" ? normalizeBoqChoice(typeof meta.boqChoice === "string" ? meta.boqChoice : "") : null;
  if (kind === "boq" && !boqChoice) return jsonError(422, "Pilih status BOQ: APD, ABD, RFSC, atau FO CUT/VANDALISME.");
  if (!picPhone) return jsonError(422, "Nomor telepon PIC tidak valid. Tulis 8–15 angka, mis. 081234567890.");

  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return jsonError(403, "Verifikasi dengan foto dilakukan oleh subcont. Admin menyetujui dari antrean.");

    const limit = verifyLimiter.check(session.subcontName);
    if (!limit.allowed) return jsonError(429, `Terlalu banyak pengiriman. Coba lagi dalam ${Math.ceil(limit.retryAfterSeconds / 60)} menit.`);
    verifyLimiter.record(session.subcontName);

    // Dua foto wajib dari kamera: Photo Evidence (barang / surat jalan) dan Photo Evidence PIC (orang yang meminta verifikasi).
    const ev = await checkPhoto(file, meta.capture, session.subcontName, "Foto evidence");
    if (!ev.ok) return jsonError(ev.status, ev.message);
    const pic = await checkPhoto(filePic, meta.capturePic, session.subcontName, "Foto PIC");
    if (!pic.ok) return jsonError(pic.status, pic.message);
    const capture = ev.capture;

    // Data terbaru: catatan verifikasi dibaca ulang agar tidak terkirim dua kali dari dua perangkat.
    const [data, hist] = await Promise.all([loadOrders(kind), loadHistory(kind, true)]);
    if (hist.warning) return jsonError(503, "Spreadsheet Verifikasi sedang tidak bisa dibuka. Coba lagi beberapa saat lagi.");
    const doc = buildDocuments(kind, data, session, hist.history).get(key);
    if (!doc) return jsonError(404, "Dokumen tidak ditemukan atau bukan milik akun ini.");
    const s = doc.summary;

    if (s.latest?.id === verificationId) {
      return NextResponse.json({ ok: true, duplicate: true, status: boqChoice ? "verified" : "pending", statusLabel: s.statusLabel }, { headers: NO_STORE });
    }
    if (!s.canVerify) return jsonError(403, "Dokumen ini diverifikasi oleh subcont tujuan.");
    const folderId = getEvidenceFolder(kind);
    const picFolderId = getPicFolder(kind);
    const driveKey = `verify:${verificationId}`;
    const picKey = `verify-pic:${verificationId}`;
    const [existing, existingPic] = await Promise.all([findDriveFileByKey(folderId, driveKey), findDriveFileByKey(picFolderId, picKey)]);
    // Sheet sudah ditulis dari pengiriman yang sama tetapi catatan belum tersimpan (koneksi putus di tengah): lanjutkan.
    const resuming = Boolean(existing) && s.status === (boqChoice ? "verified" : "pending");
    if (s.status === "verified" && !resuming) return jsonError(409, `Dokumen ini sudah ${s.statusLabel || "disetujui"}.`);
    if (s.status === "pending" && !resuming) return jsonError(409, `Dokumen ini sudah dikirim (${s.statusLabel}) dan sedang menunggu admin.`);

    const now = Date.now();
    const zone = capture.zone;
    const name = verifyPhotoFileName({
      kind,
      number: s.number,
      siteName: s.siteName,
      subcontName: session.subcontName,
      capturedAt: capture.t,
      zone,
    });
    const props = { whcKind: kind, whcSub: nameKey(session.subcontName).slice(0, 80) };
    const [photo, picPhoto] = await Promise.all([
      existing ?? uploadDriveFile({ folderId, name, mimeType: "image/jpeg", data: ev.bytes, appProperties: { whcKey: driveKey, ...props } }),
      existingPic ??
        uploadDriveFile({
          folderId: picFolderId,
          name: name.replace(/\.jpg$/, "_PIC.jpg"),
          mimeType: "image/jpeg",
          data: pic.bytes,
          appProperties: { whcKey: picKey, ...props },
        }),
    ]);
    const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

    // Sheet asli: PIC, kedua link foto, dan status (DO/TO: RECEIVED; BOQ: pilihan subcont) di semua baris dokumen.
    const statusValue = boqChoice ?? STATUS_VALUES[kind].pending ?? "";
    if (!resuming) {
      const rows = [...doc.transferLines.map((l) => l.row), ...doc.boqLines.map((l) => l.row)];
      await writeDocumentCells(kind, rows, {
        picName: picCell(picName, picPhone),
        picPhoto: link(picPhoto.id),
        evidence: link(photo.id),
        verified: statusValue,
      });
      invalidateOrders(kind);
    }

    await appendVerification(kind, {
      id: verificationId,
      key,
      number: s.number,
      siteName: s.siteName,
      subcont: s.subcont || session.subcontName,
      subcontCity: s.subcontCity,
      status: boqChoice ? STATUS_VERIFIED : STATUS_PENDING,
      submittedAt: now,
      submittedText: formatDateTime(now, zone),
      submittedBy: session.subcontName,
      location: capture.location,
      photoFileId: photo.id,
      photoName: photo.name || name,
      notes,
      materialCount: s.materialCount,
      totalQty: s.totalQty,
      // BOQ selesai saat dikirim: dicatat sebagai pilihan subcont (bukan keputusan admin).
      reviewedAt: boqChoice ? now : 0,
      reviewedText: boqChoice ? formatDateTime(now, zone) : "",
      reviewedBy: boqChoice ? `${session.subcontName} (pilih ${boqChoice})` : "",
      rejectReason: "",
      picName,
      picPhone,
      picPhotoFileId: picPhoto.id,
    });
    if (boqChoice) {
      const smdt = await syncSmdtAfterChange();
      return NextResponse.json({ ok: true, duplicate: false, status: "verified", statusLabel: boqChoice, smdt }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, duplicate: false, status: "pending", statusLabel: statusValue }, { headers: NO_STORE });
  } catch (err) {
    return ordersErrorResponse(kind, err);
  }
}
