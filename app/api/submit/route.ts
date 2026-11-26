import { NextResponse } from "next/server";
import { getDriveFolders, getJwtSecret, getResultSheet } from "@/lib/env";
import { nameKey } from "@/lib/format/text";
import { getMaterialOptions, getRegionMap } from "@/lib/google/database";
import { driveViewLink, findDriveFileByKey, uploadDriveFile } from "@/lib/google/drive";
import { appendSheetRows, formatPlainIntegerColumn, parseUpdatedRows, readSheetRanges } from "@/lib/google/sheets";
import { loadPdfAssets } from "@/lib/pdf/assets";
import { generateMaterialStockPdf } from "@/lib/pdf/material-stock";
import { finalizeReport, parseSubmitPayload, ResultSheetHeaderError, SubmitValidationError } from "@/lib/report/finalize";
import { COL_QUANTITY, RESULT_COLUMNS } from "@/lib/report/rows";
import { removeDraftStatus } from "@/lib/report/draft-status-store";
import { isSameOrigin } from "@/lib/auth/request";
import { getActiveSession, rejectIfNotSubcont, jsonError, NO_STORE, serverErrorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Penyimpanan akhir: dipanggil SETELAH semua foto berhasil diunggah.
 * Membuat PDF, lalu menulis semua baris sekaligus (beserta link PDF).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return jsonError(403, "Permintaan ditolak.");
  try {
    const session = await getActiveSession(request);
    if (!session) return jsonError(401, "Sesi berakhir. Silakan login lagi. Draf Anda tetap aman.");
    const notSubcont = rejectIfNotSubcont(session);
    if (notSubcont) return notSubcont;
    const subcont = session.subcontName;

    let payload;
    try {
      payload = parseSubmitPayload(await request.json());
    } catch (err) {
      if (err instanceof SubmitValidationError) return jsonError(422, err.message);
      return jsonError(400, "Data laporan tidak valid.");
    }

    const sheet = getResultSheet();
    const folders = getDriveFolders();
    const subKey = nameKey(subcont).slice(0, 80);

    const result = await finalizeReport(payload, subcont, {
      secret: getJwtSecret(),
      now: Date.now,
      getAccountCities: async () => (await getRegionMap()).get(nameKey(subcont)) ?? [],
      getMaterials: getMaterialOptions,
      readHeader: async () => (await readSheetRanges(sheet, ["A1:T1"]))[0]?.[0] ?? [],
      readIdAndPdfColumns: async () => {
        const [a = [], s = []] = await readSheetRanges(sheet, ["A:A", "S:S"]);
        return { ids: a.map((r) => r[0] ?? ""), pdfLinks: s.map((r) => r[0] ?? "") };
      },
      findExistingPdf: async (sid) => {
        const f = await findDriveFileByKey(folders.form, `${sid}:PDF`);
        return f ? { fileId: f.id, link: driveViewLink(f) } : null;
      },
      renderPdf: async (data) => generateMaterialStockPdf(data, await loadPdfAssets()),
      uploadPdf: async ({ submissionId, name, data }) => {
        const f = await uploadDriveFile({
          folderId: folders.form,
          name,
          mimeType: "application/pdf",
          data,
          appProperties: { whcKey: `${submissionId}:PDF`, whcSid: submissionId, whcSub: subKey },
        });
        return { fileId: f.id, link: driveViewLink(f) };
      },
      appendRows: async (rows) => {
        const updated = await appendSheetRows(sheet, RESULT_COLUMNS, rows);
        // Kolom Quantity: angka polos tanpa pemisah (data sudah tersimpan; gagal di sini tidak menggagalkan submit).
        const range = parseUpdatedRows(updated);
        if (range) {
          await formatPlainIntegerColumn(sheet, range, COL_QUANTITY).catch((err: unknown) => {
            console.error(`[WHControl] Submit: gagal memformat kolom Quantity. ${err instanceof Error ? err.message : ""}`);
          });
        }
      },
    });

    // Laporan sudah tersimpan: hapus pemberitahuan "belum terkirim" (tidak boleh menggagalkan submit).
    await removeDraftStatus(payload.submissionId, subKey).catch((err: unknown) => {
      console.error(`[WHControl] Submit: gagal menghapus status draf. ${err instanceof Error ? err.message : ""}`);
    });

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof SubmitValidationError) return jsonError(422, err.message);
    if (err instanceof ResultSheetHeaderError) {
      console.error(`[WHControl] Submit: ${err.message}`);
      return jsonError(503, "Spreadsheet hasil belum siap (header tidak sesuai). Hubungi admin. Draf Anda tetap aman.");
    }
    return serverErrorResponse(err, "Submit laporan");
  }
}
