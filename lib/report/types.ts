/**
 * Tipe data laporan yang dipakai bersama oleh browser dan server.
 * (Tanpa import Node.js agar aman di bundle klien.)
 */
import type { ZoneLabel } from "../format/time";
import type { PhotoKind } from "../format/filename";

export type { ZoneLabel, PhotoKind };

/**
 * Konteks pengambilan foto yang DITANDATANGANI server: waktu resmi server,
 * zona, koordinat, dan lokasi. Tanda tangan (sig) membuktikan nilai ini
 * berasal dari server dan tidak diubah di perangkat.
 */
export interface CaptureContext {
  /** Waktu server (epoch ms) saat tombol potret ditekan. */
  t: number;
  zone: ZoneLabel;
  lat: number;
  lon: number;
  /** Akurasi GPS (meter), hanya untuk audit di draf; tidak masuk spreadsheet. */
  acc: number;
  /** Nilai kolom Location: alamat, atau "lat, long" bila alamat tidak didapat. */
  location: string;
  /** Baris lokasi singkat untuk watermark. */
  short: string;
  source: "nominatim" | "bigdatacloud" | "coordinates";
  sig: string;
}

export interface GudangData {
  /** Kota terpilih (nilai asli database, huruf kapital). */
  regions: string[];
  warehouseName: string;
  pic: string;
  spv: string;
  pm: string;
}

/** Bukti unggah dari server (menghubungkan file Drive dengan laporan). */
export interface UploadReceipt {
  fileId: string;
  link: string;
  receipt: string;
}

export interface SubmitPhoto {
  capture: CaptureContext;
  upload: UploadReceipt;
  photoId: string;
}

export interface SubmitMaterial {
  material: string;
  remark: string;
  quantity: number;
  unit: string;
  notes: string;
  photo: SubmitPhoto;
}

export interface SubmitPayload {
  submissionId: string;
  gudang: GudangData;
  pao: SubmitPhoto;
  pac: SubmitPhoto;
  materials: SubmitMaterial[];
}

export interface SubmitResult {
  submissionId: string;
  rows: number;
  pdfFileId: string;
  pdfLink: string;
  /** true bila laporan ini sudah tersimpan sebelumnya (kirim ulang). */
  duplicate: boolean;
}

export const LIMITS = {
  textMax: 120,
  unitMax: 40,
  notesMax: 300,
  quantityMax: 10_000_000,
  materialsMax: 500,
  photoMaxBytes: 4 * 1024 * 1024,
} as const;
