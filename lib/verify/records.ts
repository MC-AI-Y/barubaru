/**
 * Catatan verifikasi DO/TO/BOQ di spreadsheet "WHControl - Verifikasi" (spesifikasi v5.0 bagian 3.2).
 * Satu tab per jenis (DO, TO, BOQ), satu baris per pengiriman verifikasi.
 * Murni (tanpa jaringan).
 */
import { cellText, nameKey } from "../format/text";
import type { OrderKind } from "../orders/types";

export type VerificationStatus = "Menunggu Admin" | "Verified" | "Ditolak";

export const STATUS_PENDING: VerificationStatus = "Menunggu Admin";
export const STATUS_VERIFIED: VerificationStatus = "Verified";
export const STATUS_REJECTED: VerificationStatus = "Ditolak";

export interface VerificationRecord {
  /** Nomor baris di tab (untuk Tahap 4: memperbarui status). */
  row: number;
  id: string;
  kind: OrderKind;
  key: string;
  number: string;
  siteName: string;
  subcont: string;
  subcontCity: string;
  status: VerificationStatus;
  submittedAt: number;
  submittedText: string;
  submittedBy: string;
  location: string;
  photoFileId: string;
  photoName: string;
  notes: string;
  materialCount: number;
  totalQty: number;
  reviewedAt: number;
  reviewedText: string;
  reviewedBy: string;
  rejectReason: string;
  /** PIC penerima barang (revisi 26 Nov 2026). */
  picName: string;
  picPhone: string;
  /** Foto orang yang meminta verifikasi (folder Photo PIC). photoFileId = foto barang / surat jalan. */
  picPhotoFileId: string;
}

/** Judul kolom tab verifikasi (A–U). Urutan ini dipakai saat menulis. */
export const VERIFY_HEADER = [
  "Verification ID",
  "Doc Key",
  "Doc Number",
  "Site Name",
  "Subcont",
  "Subcont City",
  "Status",
  "Submitted At",
  "Submitted By",
  "Location",
  "Photo File ID",
  "Photo File Name",
  "Notes",
  "Material Count",
  "Total Qty",
  "Reviewed At",
  "Reviewed By",
  "Reject Reason",
  "Submitted Epoch",
  "Reviewed Epoch",
  "Photo Link",
  "PIC Name",
  "PIC Phone",
  "PIC Photo File ID",
  "PIC Photo Link",
] as const;

export const VERIFY_COLUMNS = "A:Y";

export const VERIFY_TAB: Record<OrderKind, string> = { do: "DO", to: "TO", boq: "BOQ" };

const COL = Object.fromEntries(VERIFY_HEADER.map((h, i) => [h, i])) as Record<(typeof VERIFY_HEADER)[number], number>;

export function toStatus(value: string): VerificationStatus | null {
  const v = nameKey(value);
  if (v === "menunggu admin") return STATUS_PENDING;
  if (v === "verified") return STATUS_VERIFIED;
  if (v === "ditolak") return STATUS_REJECTED;
  return null;
}

export function recordToRow(r: Omit<VerificationRecord, "row" | "kind">): (string | number)[] {
  const row: (string | number)[] = new Array(VERIFY_HEADER.length).fill("");
  row[COL["Verification ID"]] = r.id;
  row[COL["Doc Key"]] = r.key;
  row[COL["Doc Number"]] = r.number;
  row[COL["Site Name"]] = r.siteName;
  row[COL.Subcont] = r.subcont;
  row[COL["Subcont City"]] = r.subcontCity;
  row[COL.Status] = r.status;
  row[COL["Submitted At"]] = r.submittedText;
  row[COL["Submitted By"]] = r.submittedBy;
  row[COL.Location] = r.location;
  row[COL["Photo File ID"]] = r.photoFileId;
  row[COL["Photo File Name"]] = r.photoName;
  row[COL.Notes] = r.notes;
  row[COL["Material Count"]] = r.materialCount;
  row[COL["Total Qty"]] = r.totalQty;
  row[COL["Reviewed At"]] = r.reviewedText;
  row[COL["Reviewed By"]] = r.reviewedBy;
  row[COL["Reject Reason"]] = r.rejectReason;
  row[COL["Submitted Epoch"]] = r.submittedAt || "";
  row[COL["Reviewed Epoch"]] = r.reviewedAt || "";
  row[COL["Photo Link"]] = r.photoFileId ? `https://drive.google.com/file/d/${r.photoFileId}/view` : "";
  row[COL["PIC Name"]] = r.picName;
  row[COL["PIC Phone"]] = r.picPhone;
  row[COL["PIC Photo File ID"]] = r.picPhotoFileId;
  row[COL["PIC Photo Link"]] = r.picPhotoFileId ? `https://drive.google.com/file/d/${r.picPhotoFileId}/view` : "";
  return row;
}

function num(value: string): number {
  const n = Number(cellText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Membaca satu tab. Baris tanpa ID atau status yang tidak dikenal dilewati. */
export function parseRecords(values: readonly (readonly string[])[], kind: OrderKind): VerificationRecord[] {
  const out: VerificationRecord[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] ?? [];
    const get = (h: (typeof VERIFY_HEADER)[number]) => cellText(r[COL[h]]);
    const id = get("Verification ID");
    const status = toStatus(get("Status"));
    const key = get("Doc Key");
    if (!id || !status || !key) continue;
    out.push({
      row: i + 1,
      id,
      kind,
      key,
      number: get("Doc Number"),
      siteName: get("Site Name"),
      subcont: get("Subcont"),
      subcontCity: get("Subcont City"),
      status,
      submittedAt: num(get("Submitted Epoch")),
      submittedText: get("Submitted At"),
      submittedBy: get("Submitted By"),
      location: get("Location"),
      photoFileId: get("Photo File ID"),
      photoName: get("Photo File Name"),
      notes: get("Notes"),
      materialCount: num(get("Material Count")),
      totalQty: num(get("Total Qty")),
      reviewedAt: num(get("Reviewed Epoch")),
      reviewedText: get("Reviewed At"),
      reviewedBy: get("Reviewed By"),
      rejectReason: get("Reject Reason"),
      picName: get("PIC Name"),
      picPhone: get("PIC Phone"),
      picPhotoFileId: get("PIC Photo File ID"),
    });
  }
  return out;
}

/** Riwayat per dokumen (terbaru di akhir, mengikuti urutan baris). */
export function indexByKey(records: readonly VerificationRecord[]): Map<string, VerificationRecord[]> {
  const map = new Map<string, VerificationRecord[]>();
  for (const r of records) {
    const list = map.get(r.key);
    if (list) list.push(r);
    else map.set(r.key, [r]);
  }
  return map;
}

/** Versi aman untuk browser (tanpa nomor baris). */
export type PublicVerification = Omit<VerificationRecord, "row">;

export function toPublic(r: VerificationRecord): PublicVerification {
  const { row: _row, ...rest } = r;
  void _row;
  return rest;
}
