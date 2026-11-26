/**
 * Penamaan file (readme bagian 5). Hanya untuk nama file: data asli tidak berubah.
 *   PAO  : YYYYMMDD-HHmm_SUBCONT_PAO.jpg
 *   PAC  : YYYYMMDD-HHmm_SUBCONT_PAC.jpg
 *   Foto : YYYYMMDD_SUBCONT_MATERIAL_NN.jpg
 *   PDF  : YYYYMMDD-HHmm_SUBCONT_FORM.pdf
 */
import { dateParts, type ZoneLabel } from "./time";

const LEGAL_PREFIX = /^(PT|CV)\.?(\s+|$)/i;

/** "PT Kasih Rajawali" → "KASIHRAJAWALI" (maks 20 karakter). */
export function subcontCode(subcontName: string): string {
  const withoutPrefix = subcontName.trim().replace(LEGAL_PREFIX, "");
  const code = withoutPrefix
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 20);
  return code || "SUBCONT";
}

/** 'POLE-7M 2,5"' → "POLE-7M2-5IN", "HDPE-32/28" → "HDPE-32-28". */
export function materialCode(material: string): string {
  const code = material
    .normalize("NFKD")
    .replace(/["“”″]/g, "IN")
    .replace(/[,/\\]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toUpperCase()
    .slice(0, 40);
  return code || "MATERIAL";
}

function stamp(epochMs: number, zone: ZoneLabel, withTime: boolean): string {
  const p = dateParts(epochMs, zone);
  const date = `${p.year}${p.month}${p.day}`;
  return withTime ? `${date}-${p.hour}${p.minute}` : date;
}

export type PhotoKind = "PAO" | "PAC" | "MATERIAL";

export function photoFileName(args: {
  kind: PhotoKind;
  subcontName: string;
  capturedAt: number;
  zone: ZoneLabel;
  material?: string;
  /** Nomor urut material (1-based). */
  index?: number;
}): string {
  const sub = subcontCode(args.subcontName);
  if (args.kind === "MATERIAL") {
    const nn = String(args.index ?? 1).padStart(2, "0");
    return `${stamp(args.capturedAt, args.zone, false)}_${sub}_${materialCode(args.material ?? "")}_${nn}.jpg`;
  }
  return `${stamp(args.capturedAt, args.zone, true)}_${sub}_${args.kind}.jpg`;
}

export function pdfFileName(subcontName: string, epochMs: number, zone: ZoneLabel): string {
  return `${stamp(epochMs, zone, true)}_${subcontCode(subcontName)}_FORM.pdf`;
}

/** Nomor dokumen / Site Name untuk nama file: huruf, angka, tanda hubung (maks 40). */
export function docCode(value: string): string {
  const code = value
    .normalize("NFKD")
    .replace(/[\s,/\\.]+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 40);
  return code || "X";
}

/**
 * Foto verifikasi DO/TO/BOQ (spesifikasi v5.0 bagian 5.5):
 *   DO : YYYYMMDD-HHmm_DO-<DO NUMBER>_<SUBCONT>.jpg
 *   TO : YYYYMMDD-HHmm_TO-<TO NUMBER>_<SUBCONT>.jpg
 *   BOQ: YYYYMMDD-HHmm_BOQ-<SITE NAME>_<SUBCONT>.jpg   (BOQ format sederhana tanpa PO Number)
 */
export function verifyPhotoFileName(args: {
  kind: "do" | "to" | "boq";
  number: string;
  siteName?: string;
  subcontName: string;
  capturedAt: number;
  zone: ZoneLabel;
}): string {
  const id = args.kind === "boq" ? args.siteName || args.number : args.number;
  return `${stamp(args.capturedAt, args.zone, true)}_${args.kind.toUpperCase()}-${docCode(id)}_${subcontCode(args.subcontName)}.jpg`;
}
