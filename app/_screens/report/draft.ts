/**
 * Struktur draf laporan di perangkat.
 */
import type { CaptureContext, GudangData, UploadReceipt } from "@/lib/report/types";
import { parseQuantity, validateMaterialFields, hasErrors, type MaterialOptionLike } from "@/lib/report/validate";
import type { ScreenId } from "../steps";

export interface PhotoRef {
  id: string;
  capture: CaptureContext;
  width: number;
  height: number;
  bytes: number;
}

export interface MaterialEntry {
  id: string;
  material: string;
  remark: string;
  /** Teks dari input, angka saja ("1200"). */
  quantity: string;
  unit: string;
  notes: string;
  photo: PhotoRef | null;
}

export interface Draft {
  v: 1;
  submissionId: string;
  subcontName: string;
  createdAt: number;
  updatedAt: number;
  /** Layar terakhir, untuk melanjutkan draf. */
  step: ScreenId;
  pao: PhotoRef | null;
  gudang: GudangData;
  materials: MaterialEntry[];
  /** Form material yang sedang diisi. */
  form: MaterialEntry;
  /** Bila sedang mengedit material yang sudah ada di daftar. */
  editingId: string | null;
  pac: PhotoRef | null;
  /** Bukti unggah per photoId (untuk melanjutkan "Coba Lagi"). */
  uploads: Record<string, UploadReceipt>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyForm(): MaterialEntry {
  return { id: newId(), material: "", remark: "", quantity: "", unit: "", notes: "", photo: null };
}

export function newDraft(subcontName: string): Draft {
  const now = Date.now();
  return {
    v: 1,
    submissionId: newId(),
    subcontName,
    createdAt: now,
    updatedAt: now,
    step: "pao",
    pao: null,
    gudang: { regions: [], warehouseName: "", pic: "", spv: "", pm: "" },
    materials: [],
    form: emptyForm(),
    editingId: null,
    pac: null,
    uploads: {},
  };
}

export function isFormEmpty(f: MaterialEntry): boolean {
  return !f.material && !f.quantity.trim() && !f.unit.trim() && !f.notes.trim() && !f.photo;
}

/** Field yang tercetak di watermark sudah lengkap (syarat tombol foto aktif). */
export function formReadyForPhoto(f: MaterialEntry, options: readonly MaterialOptionLike[]): boolean {
  return !hasErrors(validateMaterialFields({ ...f, notes: "" }, options));
}

export function isEntryComplete(f: MaterialEntry, options: readonly MaterialOptionLike[]): boolean {
  return formReadyForPhoto(f, options) && !!f.photo && parseQuantity(f.quantity) !== null;
}

/** Semua photoId dalam draf (untuk membersihkan foto yatim). */
export function photoIds(d: Draft): string[] {
  const ids: string[] = [];
  if (d.pao) ids.push(d.pao.id);
  if (d.pac) ids.push(d.pac.id);
  if (d.form.photo) ids.push(d.form.photo.id);
  for (const m of d.materials) if (m.photo) ids.push(m.photo.id);
  return ids;
}

/** Konteks foto terbaru (untuk cache lokasi per laporan). */
export function latestCapture(d: Draft): CaptureContext | null {
  const all = [d.pao, d.pac, d.form.photo, ...d.materials.map((m) => m.photo)]
    .filter((p): p is PhotoRef => Boolean(p))
    .map((p) => p.capture)
    .filter((c) => c.source !== "coordinates");
  all.sort((a, b) => b.t - a.t);
  return all[0] ?? null;
}

export function gudangLocked(d: Draft): boolean {
  return Boolean(d.form.photo) || d.materials.some((m) => m.photo);
}
