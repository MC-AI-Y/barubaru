/**
 * Tipe data DO, TO, dan BOQ (spesifikasi v5.0 bagian 5 dan 6).
 * Dipakai server dan browser; tidak memuat apa pun yang rahasia.
 */

export type OrderKind = "do" | "to" | "boq";

export const ORDER_KINDS: readonly OrderKind[] = ["do", "to", "boq"];

export const ORDER_LABEL: Record<OrderKind, string> = {
  do: "DO (Delivery Order)",
  to: "TO (Transfer Order)",
  boq: "BOQ",
};

/** Satu baris material di DO atau TO. */
export interface TransferLine {
  /** Nomor baris di sheet (1 = baris pertama). Dipakai untuk menulis kolom Verified di Tahap 4. */
  row: number;
  docNumber: string;
  originSubcont: string;
  originCity: string;
  originSubcontCity: string;
  destSubcont: string;
  destCity: string;
  destSubcontCity: string;
  region: string;
  material: string;
  qty: number | null;
  qtyText: string;
  /** Isi kolom PIC Name (nama + telepon PIC penerima). */
  picName: string;
  /** Isi kolom Photo Evidence PIC (link foto orang yang meminta verifikasi). */
  picPhoto: string;
  /** Isi kolom Photo Evidence (link foto barang / surat jalan). */
  evidence: string;
  /** Isi asli kolom Verified (ON DELIVERY / RECEIVED / APPROVED / NEED CHECK / kosong). */
  statusValue: string;
  /** Baris ini disetujui (APPROVED, atau nilai lama VERIFIED/"Verified"/centang). */
  verified: boolean;
}

/** Satu baris material di BOQ (format sederhana, revisi 26 Nov 2026). */
export interface BoqLine {
  row: number;
  picName: string;
  picPhoto: string;
  evidence: string;
  siteName: string;
  subcont: string;
  city: string;
  subcontCity: string;
  region: string;
  siteType: string;
  /** Kolom Status (tahapan pekerjaan site, mis. RFSC). */
  status: string;
  material: string;
  qty: number | null;
  qtyText: string;
  /** Isi asli kolom Verified (APD / ABD / RFSC / FO CUT/VANDALISME / kosong). */
  statusValue: string;
  /** Baris ini sudah diverifikasi subcont (salah satu dari 4 pilihan). */
  verified: boolean;
}

/**
 * Golongan status satu dokumen (dari kolom Verified di sheet asli):
 * open = kosong / ON DELIVERY / nilai tidak dikenal, pending = RECEIVED (DO/TO),
 * rejected = NEED CHECK (DO/TO), verified = APPROVED / pilihan BOQ. Teks yang ditampilkan ada di statusLabel.
 */
export type OrderStatus = "open" | "pending" | "rejected" | "verified";

/** Ringkasan verifikasi terakhir dokumen (dari spreadsheet Verifikasi). */
export interface LatestVerification {
  id: string;
  status: "Menunggu Admin" | "Verified" | "Ditolak";
  submittedAt: number;
  submittedText: string;
  submittedBy: string;
  rejectReason: string;
  reviewedText: string;
  /** Ada foto PIC (verifikasi v5.2 ke atas). */
  hasPicPhoto: boolean;
}

/** Arah TO dilihat dari subcont yang login: masuk (Borrow) atau keluar (Handover). */
export type Direction = "in" | "out";

/** Ringkasan satu dokumen untuk daftar. */
export interface OrderSummary {
  kind: OrderKind;
  /** Kunci dokumen: nomor DO/TO, atau Site Name + Subcont City untuk BOQ. */
  key: string;
  /** Yang ditampilkan sebagai judul: DO/TO NUMBER, atau Site Name untuk BOQ. */
  number: string;
  /** Subcont yang memverifikasi (tujuan DO/TO, pemilik BOQ). */
  subcont: string;
  subcontCity: string;
  region: string;
  /** Asal dan tujuan (DO/TO). */
  origin: string;
  destination: string;
  /** BOQ */
  siteName: string;
  siteType: string;
  /** Kolom Status BOQ (tahapan pekerjaan). */
  boqStatus: string;
  materialCount: number;
  /** Jumlah QTY. */
  totalQty: number;
  status: OrderStatus;
  /** Nilai kolom Verified seperti di database (kosong bila belum ada status). */
  statusLabel: string;
  /** PIC dan link foto dari sheet (terisi setelah subcont mengirim). */
  picName: string;
  picPhoto: string;
  evidence: string;
  /** Sebagian baris sudah Verified, sebagian belum. */
  partial: boolean;
  /** Hanya TO, untuk subcont: in = tujuan (memverifikasi), out = asal (informasi). */
  direction: Direction | null;
  /** Akun yang login (subcont) boleh mengirim verifikasi dokumen ini. Untuk admin: boleh memutuskan. */
  canVerify: boolean;
  /** Perlu tindakan akun ini: subcont = belum/ditolak; admin = menunggu admin. */
  needsAction: boolean;
  latest: LatestVerification | null;
  /** Baris sheet terbesar; dipakai mengurutkan dari yang terbaru. */
  lastRow: number;
}

export interface VerificationView {
  id: string;
  status: "Menunggu Admin" | "Verified" | "Ditolak";
  submittedText: string;
  submittedBy: string;
  picName: string;
  picPhone: string;
  location: string;
  hasPicPhoto: boolean;
  notes: string;
  reviewedText: string;
  reviewedBy: string;
  rejectReason: string;
  hasPhoto: boolean;
}

export interface OrderDetail {
  summary: OrderSummary;
  transferLines: TransferLine[];
  boqLines: BoqLine[];
  /** Riwayat verifikasi dokumen ini, terbaru dulu. */
  history: VerificationView[];
}

export interface OrderKpi {
  documents: number;
  /** Perlu tindakan akun ini. */
  action: number;
  /** Menunggu pihak lain (subcont: menunggu admin; admin: belum dikirim subcont). */
  waiting: number;
  verified: number;
  totalQty: number;
}

export interface SubcontRecap {
  subcont: string;
  documents: number;
  /** Perlu tindakan (admin: menunggu admin). */
  action: number;
}

/** todo = perlu tindakan akun ini; waiting = menunggu pihak lain; verified; all. */
export type OrderView = "todo" | "waiting" | "verified" | "all";

export interface OrderListResponse {
  kind: OrderKind;
  view: OrderView;
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  kpi: OrderKpi;
  /** Pilihan region dalam cakupan akun (untuk dropdown Region). */
  regions: string[];
  /** Rekap per subcont (khusus admin). */
  subconts: SubcontRecap[] | null;
  updatedAt: number;
  /** Pesan bila spreadsheet Verifikasi gagal dibaca (daftar tetap tampil dari sheet asli). */
  verifyWarning: string | null;
}

export interface OrderCountsResponse {
  counts: Record<OrderKind, number | null>;
  /** Pesan untuk database yang gagal dibaca (ditampilkan di "Perlu tindakan" Beranda). */
  errors: Partial<Record<OrderKind, string>>;
}
