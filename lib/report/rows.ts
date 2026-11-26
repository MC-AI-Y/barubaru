/**
 * Baris spreadsheet hasil input (readme bagian 7): 20 kolom A–T.
 * Satu baris = satu material. Data gudang diulang di setiap baris;
 * Date/Time/Location mengikuti foto material masing-masing.
 */
import { formatRegionList } from "../format/region";
import { collapseSpaces } from "../format/text";
import { formatDate, formatTime, type ZoneLabel } from "../format/time";
import type { CellValue } from "../google/sheets";
import type { SubmitPayload } from "./types";

export const RESULT_HEADERS = [
  "Submission ID",
  "Subcont Name",
  "Photo Authorized Open",
  "Date",
  "Time",
  "Location",
  "Region",
  "Warehouse Name",
  "PIC Subcont",
  "YOFC SPV",
  "YOFC PM/RPM",
  "Material",
  "Remark",
  "Quantity",
  "Satuan",
  "Photo",
  "Notes",
  "Photo Authorized Closed",
  "Form PDF",
  "Submitted At (Server)",
] as const;

/** Kolom A–T (v4.7) + U = Subcont City (v5.0, Q17). Header dicek di A–T; admin menambahkan judul kolom U. */
export const RESULT_COLUMNS = "A:U";
export const SUBCONT_CITY_HEADER = "Subcont City";

/** Subcont City = Subcont + spasi + City (Q3), mis. "CV DAYA ABADI BOGOR". */
export function subcontCityOf(subcontName: string, city: string): string {
  return collapseSpaces(`${subcontName} ${city}`).toLocaleUpperCase("id-ID");
}
/** Indeks kolom (0-based) yang dipakai untuk pengecekan kirim ulang. */
export const COL_SUBMISSION_ID = 0;
export const COL_FORM_PDF = 18;
/** Kolom N (Quantity), 0-based. */
export const COL_QUANTITY = 13;

export function buildResultRows(args: {
  payload: SubmitPayload;
  subcontName: string;
  pdfLink: string;
  submittedAt: number;
  submittedZone?: ZoneLabel;
}): CellValue[][] {
  const { payload: p, subcontName, pdfLink, submittedAt } = args;
  const region = formatRegionList(p.gudang.regions, "sheet");
  const submitted = `${formatDate(submittedAt, args.submittedZone ?? "WIB")} ${formatTime(submittedAt, args.submittedZone ?? "WIB")}`;

  return p.materials.map((m) => [
    p.submissionId,
    subcontName,
    p.pao.upload.link,
    formatDate(m.photo.capture.t, m.photo.capture.zone),
    formatTime(m.photo.capture.t, m.photo.capture.zone),
    m.photo.capture.location,
    region,
    p.gudang.warehouseName,
    p.gudang.pic,
    p.gudang.spv,
    p.gudang.pm,
    m.material,
    m.remark,
    m.quantity,
    m.unit,
    m.photo.upload.link,
    m.notes,
    p.pac.upload.link,
    pdfLink,
    submitted,
    subcontCityOf(subcontName, p.gudang.regions[0] ?? ""),
  ]);
}
