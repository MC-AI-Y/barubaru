/**
 * Penyimpanan akhir laporan (readme bagian 8, keputusan #17):
 *   validasi ulang → cek kirim ulang (Submission ID) → buat & simpan PDF
 *   → tulis SEMUA baris sekaligus (sudah berisi link PDF).
 * Semua dependensi diinjeksi agar logika bisa diuji tanpa Google.
 */
import { formatRegionList, orderByDatabase } from "../format/region";
import { collapseSpaces, nameKey } from "../format/text";
import { formatDate, type ZoneLabel } from "../format/time";
import { pdfFileName } from "../format/filename";
import type { CellValue } from "../google/sheets";
import { headerNameMatches, type MaterialOption } from "../google/parse";
import type { MaterialStockData } from "../pdf/material-stock";
import { buildResultRows, COL_FORM_PDF, COL_SUBMISSION_ID, RESULT_HEADERS } from "./rows";
import { verifyCapture, verifyUpload } from "./signature";
import { formatQuantity, parseQuantity, validateGudang, validateMaterialFields, hasErrors } from "./validate";
import { LIMITS, type SubmitPayload, type SubmitPhoto, type SubmitResult } from "./types";

export class SubmitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmitValidationError";
  }
}

export class ResultSheetHeaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultSheetHeaderError";
  }
}

export interface StoredPdf {
  fileId: string;
  link: string;
}

export interface FinalizeDeps {
  secret: string;
  now: () => number;
  getAccountCities: () => Promise<string[]>;
  getMaterials: () => Promise<MaterialOption[]>;
  /** Baris header (baris 1) spreadsheet hasil. */
  readHeader: () => Promise<string[]>;
  /** Kolom A (Submission ID) dan S (Form PDF), termasuk header. */
  readIdAndPdfColumns: () => Promise<{ ids: string[]; pdfLinks: string[] }>;
  findExistingPdf: (submissionId: string) => Promise<StoredPdf | null>;
  renderPdf: (data: MaterialStockData) => Promise<Uint8Array>;
  uploadPdf: (args: { submissionId: string; name: string; data: Uint8Array }) => Promise<StoredPdf>;
  appendRows: (rows: CellValue[][]) => Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? collapseSpaces(v).slice(0, max) : "";
}

/** Membersihkan dan memeriksa bentuk payload dari browser. */
export function parseSubmitPayload(body: unknown): SubmitPayload {
  if (typeof body !== "object" || body === null) throw new SubmitValidationError("Data laporan tidak valid.");
  const b = body as Record<string, unknown>;
  if (typeof b.submissionId !== "string" || !UUID_RE.test(b.submissionId)) {
    throw new SubmitValidationError("Submission ID tidak valid.");
  }
  const g = (b.gudang ?? {}) as Record<string, unknown>;
  const regions = Array.isArray(g.regions) ? g.regions.filter((r): r is string => typeof r === "string").slice(0, 200) : [];
  const photo = (p: unknown): SubmitPhoto => {
    const o = (p ?? {}) as Record<string, unknown>;
    const u = (o.upload ?? {}) as Record<string, unknown>;
    return {
      photoId: typeof o.photoId === "string" ? o.photoId.slice(0, 64) : "",
      capture: o.capture as SubmitPhoto["capture"],
      upload: {
        fileId: typeof u.fileId === "string" ? u.fileId.slice(0, 200) : "",
        link: typeof u.link === "string" ? u.link.slice(0, 500) : "",
        receipt: typeof u.receipt === "string" ? u.receipt.slice(0, 100) : "",
      },
    };
  };
  const materials = Array.isArray(b.materials) ? b.materials : [];
  if (materials.length === 0) throw new SubmitValidationError("Minimal 1 material per laporan.");
  if (materials.length > LIMITS.materialsMax) throw new SubmitValidationError(`Maksimal ${LIMITS.materialsMax} material per laporan.`);

  return {
    submissionId: b.submissionId.toLowerCase(),
    gudang: {
      regions,
      warehouseName: str(g.warehouseName, LIMITS.textMax),
      pic: str(g.pic, LIMITS.textMax),
      spv: str(g.spv, LIMITS.textMax),
      pm: str(g.pm, LIMITS.textMax),
    },
    pao: photo(b.pao),
    pac: photo(b.pac),
    materials: materials.map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        material: typeof o.material === "string" ? o.material : "",
        remark: typeof o.remark === "string" ? o.remark : "",
        quantity: typeof o.quantity === "number" ? o.quantity : Number.NaN,
        unit: str(o.unit, LIMITS.unitMax),
        notes: typeof o.notes === "string" ? o.notes.trim().slice(0, LIMITS.notesMax) : "",
        photo: photo(o.photo),
      };
    }),
  };
}

function checkPhoto(p: SubmitPhoto, kind: string, label: string, sid: string, subcont: string, secret: string): void {
  if (!verifyCapture(p.capture, subcont, secret)) {
    throw new SubmitValidationError(`${label}: data waktu/lokasi foto tidak sah. Ambil ulang foto tersebut.`);
  }
  const ok =
    p.photoId &&
    p.upload.fileId &&
    verifyUpload({ submissionId: sid, kind, photoId: p.photoId, fileId: p.upload.fileId, receipt: p.upload.receipt }, subcont, secret);
  if (!ok) throw new SubmitValidationError(`${label}: bukti unggah tidak sah. Coba kirim ulang.`);
}

/** Validasi lengkap di server (readme bagian 6). */
export async function validateSubmission(payload: SubmitPayload, subcont: string, deps: Pick<FinalizeDeps, "secret" | "getAccountCities" | "getMaterials">): Promise<SubmitPayload> {
  const cities = await deps.getAccountCities();
  const gErrors = validateGudang(payload.gudang, cities);
  if (hasErrors(gErrors)) throw new SubmitValidationError(Object.values(gErrors).filter(Boolean).join(" "));

  const options = await deps.getMaterials();
  payload.materials.forEach((m, i) => {
    const errors = validateMaterialFields(
      { material: m.material, remark: m.remark, quantity: String(m.quantity), unit: m.unit, notes: m.notes },
      options,
    );
    if (hasErrors(errors) || parseQuantity(m.quantity) === null) {
      throw new SubmitValidationError(`Material #${i + 1}: ${Object.values(errors).filter(Boolean).join(" ") || "Quantity tidak valid."}`);
    }
  });

  const sid = payload.submissionId;
  checkPhoto(payload.pao, "PAO", "Selfie awal", sid, subcont, deps.secret);
  checkPhoto(payload.pac, "PAC", "Foto penutup", sid, subcont, deps.secret);
  payload.materials.forEach((m, i) => checkPhoto(m.photo, "MATERIAL", `Foto material #${i + 1}`, sid, subcont, deps.secret));

  // Region selalu disimpan mengikuti urutan database.
  return { ...payload, gudang: { ...payload.gudang, regions: orderByDatabase(payload.gudang.regions, cities) } };
}

export function headerMatches(actual: readonly string[]): boolean {
  return RESULT_HEADERS.every((h, i) => headerNameMatches(actual[i] ?? "", h));
}

export function buildPdfData(payload: SubmitPayload, subcont: string): MaterialStockData {
  const pao = payload.pao.capture;
  return {
    subcontName: subcont,
    region: formatRegionList(payload.gudang.regions, "display"),
    warehouseName: payload.gudang.warehouseName,
    warehouseAddress: pao.location,
    date: formatDate(pao.t, pao.zone),
    pic: payload.gudang.pic,
    spv: payload.gudang.spv,
    pm: payload.gudang.pm,
    submissionId: payload.submissionId,
    materials: payload.materials.map((m) => ({
      name: m.material,
      quantity: `${formatQuantity(m.quantity)} ${m.unit}`,
      remark: m.remark,
      notes: m.notes,
    })),
  };
}

/** Kunci per Submission ID di instance ini, agar dua permintaan bersamaan tidak sama-sama menulis. */
const inflight = new Map<string, Promise<SubmitResult>>();

export function finalizeReport(rawPayload: SubmitPayload, subcont: string, deps: FinalizeDeps): Promise<SubmitResult> {
  const sid = rawPayload.submissionId;
  const existing = inflight.get(sid);
  if (existing) return existing;
  const job = runFinalize(rawPayload, subcont, deps).finally(() => inflight.delete(sid));
  inflight.set(sid, job);
  return job;
}

async function runFinalize(rawPayload: SubmitPayload, subcont: string, deps: FinalizeDeps): Promise<SubmitResult> {
  const payload = await validateSubmission(rawPayload, subcont, deps);
  const sid = payload.submissionId;

  // 1. Kirim ulang? Bila Submission ID sudah ada, jangan tulis lagi.
  const { ids, pdfLinks } = await deps.readIdAndPdfColumns();
  const rowIndex = ids.findIndex((v, i) => i > 0 && v.trim().toLowerCase() === sid);
  if (rowIndex > 0) {
    const pdf = await deps.findExistingPdf(sid);
    const count = ids.filter((v) => v.trim().toLowerCase() === sid).length;
    return { submissionId: sid, rows: count, pdfFileId: pdf?.fileId ?? "", pdfLink: pdf?.link ?? pdfLinks[rowIndex] ?? "", duplicate: true };
  }

  // 2. Header harus sesuai skema 20 kolom agar data tidak masuk ke kolom yang salah.
  const header = await deps.readHeader();
  if (!headerMatches(header)) {
    throw new ResultSheetHeaderError("Header spreadsheet hasil tidak sesuai skema 20 kolom (readme bagian 7).");
  }

  // 3. PDF (dipakai ulang bila sudah pernah dibuat untuk laporan ini).
  let pdf = await deps.findExistingPdf(sid);
  if (!pdf) {
    const bytes = await deps.renderPdf(buildPdfData(payload, subcont));
    const pao = payload.pao.capture;
    pdf = await deps.uploadPdf({ submissionId: sid, name: pdfFileName(subcont, pao.t, pao.zone as ZoneLabel), data: bytes });
  }

  // 4. Semua baris sekaligus.
  const rows = buildResultRows({ payload, subcontName: subcont, pdfLink: pdf.link, submittedAt: deps.now() });
  await deps.appendRows(rows);

  return { submissionId: sid, rows: rows.length, pdfFileId: pdf.fileId, pdfLink: pdf.link, duplicate: false };
}

export { COL_SUBMISSION_ID, COL_FORM_PDF };
