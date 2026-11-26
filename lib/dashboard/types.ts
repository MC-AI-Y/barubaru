/**
 * Tipe Dashboard (Stock) dan SMDT (spesifikasi v5.0 bagian 4). Dipakai server dan browser.
 */

/** Satu baris SMDT: satu Subcont City + satu material. */
export interface StockRow {
  subcontCity: string;
  /** Nama subcont pemilik (untuk filter akses). */
  subcont: string;
  /** Kota (kolom City / CITY ... di DO, TO, BOQ); cadangan: Subcont City dikurangi nama subcont. Untuk filter City. */
  city: string;
  region: string;
  material: string;
  do: number;
  borrow: number;
  totalIn: number;
  boq: number;
  handover: number;
  totalOut: number;
  /** Bagian Total In / Total Out dari dokumen yang SUDAH disetujui (VERIFIED / APD). Sisanya belum diverifikasi. */
  inVerified: number;
  outVerified: number;
  /** Rincian bagian yang sudah disetujui per kolom (untuk tampilan "Hanya terverifikasi"). */
  verifiedPart: { do: number; borrow: number; boq: number; handover: number };
  inventoryByData: number;
  /** null bila belum ada laporan Visit untuk Subcont City ini (atau Visit mencakup banyak kota). */
  inventoryActual: number | null;
  /** inventoryByData − inventoryActual; null bila Inventory Actual belum ada. */
  gap: number | null;
}

export interface VisitInfo {
  subcontCity: string;
  subcont: string;
  /** Teks "Submitted At (Server)" dari laporan Visit terakhir. */
  lastVisitText: string;
  submissionId: string;
  materialCount: number;
}

export interface PendingCounts {
  do: number;
  to: number;
  boq: number;
}

export interface SubcontCityRank {
  subcontCity: string;
  subcont: string;
  absGap: number;
  pending: number;
  lastVisitText: string;
}

export interface DashboardResponse {
  rows: StockRow[];
  visits: VisitInfo[];
  /** DO/TO/BOQ yang belum Verified (belum masuk hitungan), sesuai akun. */
  pending: PendingCounts;
  /** Khusus admin. */
  ranking: SubcontCityRank[] | null;
  /** Laporan Visit yang mencakup lebih dari satu kota (tidak bisa dibagi ke Subcont City). */
  multiCityVisits: number;
  warnings: string[];
  computedAt: number;
}

export interface SmdtSyncResponse {
  written: number;
  remarksKept: number;
  computedAt: number;
}
