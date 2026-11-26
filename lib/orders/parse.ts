/**
 * Pembaca sheet DO, TO, dan BOQ menjadi baris dan dokumen.
 * Murni (tanpa jaringan) agar mudah diuji. Kolom dicari berdasarkan NAMA judul,
 * sehingga urutan kolom bebas dan baris judul boleh di baris 1 sampai 10.
 */
import { cellText, nameKey } from "../format/text";
import { SheetFormatError } from "../google/parse";
import { rowState } from "./status";
import type { BoqLine, OrderKind, TransferLine } from "./types";

type Values = readonly (readonly string[])[];

/** Judul kolom DO/TO (spesifikasi v5.0 bagian 5.1). */
export const TRANSFER_HEADERS = {
  origin: "WH/SUPPLIER ORIGIN",
  originCity: "CITY/SUPPLIER NAME ORIGIN",
  originSubcontCity: "WH NAME/SUPPLIER CITY ORIGIN",
  dest: "WH/SUPPLIER DESTINATION",
  destCity: "CITY/SUPPLIER NAME DESTINATION",
  destSubcontCity: "WH NAME/SUPPLIER CITY DESTINATION",
  region: "REGION",
  material: "MATERIAL NAME",
  qty: "QTY",
  verified: "Verified",
  picName: "PIC Name",
  picPhoto: "Photo Evidence PIC",
  evidence: "Photo Evidence",
} as const;

export const DOC_NUMBER_HEADER: Record<"do" | "to", string> = { do: "DO NUMBER", to: "TO NUMBER" };

/** Judul kolom BOQ format sederhana (revisi 26 Nov 2026). City/Subcont City/Region/Site Type/Status/PIC boleh tidak ada. */
export const BOQ_HEADERS = {
  picName: "PIC Name",
  picPhoto: "Photo Evidence PIC",
  evidence: "Photo Evidence",
  siteName: "Site Name",
  subcont: "Subcont",
  city: "City",
  subcontCity: "Subcont City",
  region: "Region",
  siteType: "Site Type",
  status: "Status",
  material: "Material Name",
  qty: "QTY",
  verified: "Verified",
} as const;

const BOQ_REQUIRED: readonly (keyof typeof BOQ_HEADERS)[] = ["siteName", "subcont", "material", "qty", "verified"];

/** Nama lain judul kolom yang juga diterima. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  "DO NUMBER": ["DO NO", "DO NO.", "NO DO", "DO"],
  "TO NUMBER": ["TO NO", "TO NO.", "NO TO", "TO"],
  QTY: ["QUANTITY"],
  "PIC Name": ["PIC", "Nama PIC"],
  "Photo Evidence PIC": ["Photo PIC", "Foto PIC"],
  "Photo Evidence": ["Photo Evidence DO", "Photo Evidence TO", "Photo Evidence BOQ", "Evidence", "Foto Evidence"],
  Subcont: ["Subcont Name"],
};

function candidates(name: string): string[] {
  return [name, ...(ALIASES[name] ?? [])].map(nameKey);
}

/**
 * Mencari baris judul: baris pertama (dari 10 baris teratas) yang memuat judul kunci.
 * Mengembalikan indeks baris dan peta judul → indeks kolom (-1 bila tidak ada).
 */
export function locateHeader<K extends string>(
  values: Values,
  headers: Readonly<Record<K, string>>,
  anchor: K,
  required: readonly K[],
  sheetLabel: string,
): { headerIndex: number; cols: Record<K, number> } {
  const limit = Math.min(values.length, 10);
  for (let i = 0; i < limit; i++) {
    const normalized = (values[i] ?? []).map((c) => nameKey(cellText(c)));
    if (!normalized.some((h) => candidates(headers[anchor]).includes(h))) continue;
    const cols = {} as Record<K, number>;
    for (const key of Object.keys(headers) as K[]) {
      const names = candidates(headers[key]);
      cols[key] = normalized.findIndex((h) => names.includes(h));
    }
    const missing = required.filter((k) => cols[k] < 0).map((k) => `"${headers[k]}"`);
    if (missing.length) {
      throw new SheetFormatError(`Kolom ${missing.join(", ")} tidak ditemukan di baris judul ${sheetLabel} (baris ${i + 1}).`);
    }
    return { headerIndex: i, cols };
  }
  throw new SheetFormatError(`Baris judul ${sheetLabel} tidak ditemukan (kolom "${headers[anchor]}" dicari di 10 baris teratas).`);
}

/** Kolom Verified dianggap terverifikasi bila berisi teks "Verified" atau centang (TRUE). */
export function isVerifiedCell(value: string): boolean {
  const v = nameKey(value);
  return v === "verified" || v === "true" || v === "ya" || v === "yes" || v === "✓" || v === "✔";
}

/**
 * Angka jumlah dari sel. Menerima 1200, 1.200, 1,200, 1 200, dan desimal 12,5 / 12.5.
 * Sel kosong atau bukan angka menghasilkan null.
 */
export function parseQty(value: string): number | null {
  const raw = cellText(value).replace(/\s/g, "");
  if (!raw) return null;
  let s = raw;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, "");
  else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cell(row: readonly string[], idx: number): string {
  return idx >= 0 ? cellText(row[idx]) : "";
}

/** Membaca sheet DO atau TO. Baris tanpa nomor dokumen dan tanpa material dilewati. */
export function parseTransferSheet(values: Values, kind: "do" | "to"): TransferLine[] {
  const headers = { docNumber: DOC_NUMBER_HEADER[kind], ...TRANSFER_HEADERS };
  type K = keyof typeof headers;
  const required: K[] = ["docNumber", "dest", "destSubcontCity", "material", "qty", "verified"];
  const label = kind === "do" ? "sheet DO" : "sheet TO";
  const { headerIndex, cols } = locateHeader<K>(values, headers, "docNumber", required, label);

  const lines: TransferLine[] = [];
  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const docNumber = cell(row, cols.docNumber);
    const material = cell(row, cols.material);
    if (!docNumber || !material) continue;
    const qtyText = cell(row, cols.qty);
    const statusValue = cell(row, cols.verified);
    lines.push({
      row: i + 1,
      docNumber,
      originSubcont: cell(row, cols.origin),
      originCity: cell(row, cols.originCity),
      originSubcontCity: cell(row, cols.originSubcontCity),
      destSubcont: cell(row, cols.dest),
      destCity: cell(row, cols.destCity),
      destSubcontCity: cell(row, cols.destSubcontCity),
      region: cell(row, cols.region),
      material,
      qty: parseQty(qtyText),
      qtyText,
      picName: cell(row, cols.picName),
      picPhoto: cell(row, cols.picPhoto),
      evidence: cell(row, cols.evidence),
      statusValue,
      verified: rowState(kind, statusValue) === "approved",
    });
  }
  return lines;
}

/** Membaca sheet BOQ. Bila kolom Subcont City tidak ada, dibentuk dari Subcont + spasi + City. */
export function parseBoqSheet(values: Values): BoqLine[] {
  type K = keyof typeof BOQ_HEADERS;
  const { headerIndex, cols } = locateHeader<K>(values, BOQ_HEADERS, "siteName", BOQ_REQUIRED, "sheet BOQ");

  const lines: BoqLine[] = [];
  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const siteName = cell(row, cols.siteName);
    const material = cell(row, cols.material);
    const subcont = cell(row, cols.subcont);
    if (!material || !siteName || !subcont) continue;
    const city = cell(row, cols.city);
    const qtyText = cell(row, cols.qty);
    const statusValue = cell(row, cols.verified);
    lines.push({
      row: i + 1,
      picName: cell(row, cols.picName),
      picPhoto: cell(row, cols.picPhoto),
      evidence: cell(row, cols.evidence),
      siteName,
      subcont,
      city,
      subcontCity: cell(row, cols.subcontCity) || [subcont, city].filter(Boolean).join(" "),
      region: cell(row, cols.region),
      siteType: cell(row, cols.siteType),
      status: cell(row, cols.status),
      material,
      qty: parseQty(qtyText),
      qtyText,
      statusValue,
      verified: rowState("boq", statusValue) === "approved",
    });
  }
  return lines;
}

/** Remark TRUE/FALSE (checkbox) ditampilkan sebagai Ya/Tidak (R8). */
export function displayRemark(value: string): string {
  const v = nameKey(value);
  if (v === "true") return "Ya";
  if (v === "false") return "Tidak";
  return value;
}

/** Kunci dokumen. */
export function transferKey(line: Pick<TransferLine, "docNumber">): string {
  return nameKey(line.docNumber);
}

/** Dokumen BOQ = Site Name + Subcont City (format sederhana tidak punya PO Number). */
export function boqKey(line: Pick<BoqLine, "siteName" | "subcontCity">): string {
  return [line.siteName, line.subcontCity].map(nameKey).join("|");
}

/** Mengelompokkan baris berdasarkan kunci, mempertahankan urutan kemunculan. */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function kindLabel(kind: OrderKind): string {
  return kind === "do" ? "DO" : kind === "to" ? "TO" : "BOQ";
}
