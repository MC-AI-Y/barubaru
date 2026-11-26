/**
 * Aturan validasi laporan (readme bagian 4 dan 6). Dipakai di browser
 * (pesan per field) dan di server (validasi ulang sebelum menyimpan).
 */
import { collapseSpaces } from "../format/text";
import { LIMITS, type GudangData } from "./types";

/**
 * Quantity = bilangan bulat > 0, ditulis angka saja tanpa pemisah apa pun
 * (readme bagian 4B): "1200" → 1200. Titik, koma, spasi, dan desimal ditolak.
 * null bila tidak valid.
 */
export function parseQuantity(input: string | number): number | null {
  if (typeof input === "number") return Number.isInteger(input) && input > 0 && input <= LIMITS.quantityMax ? input : null;
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 && n <= LIMITS.quantityMax ? n : null;
}

/** 1200 → "1200" (angka saja, tanpa pemisah ribuan). */
export function formatQuantity(n: number): string {
  return String(Math.round(n));
}

/** Untuk kolom input: hanya angka yang diterima ("1.200" → "1200", "12,5" → "125"). */
export function formatQuantityInput(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 8);
}

export type GudangErrors = Partial<Record<keyof GudangData, string>>;

export function validateGudang(g: GudangData, allowedCities?: readonly string[]): GudangErrors {
  const e: GudangErrors = {};
  // v5.0 (Q17): satu laporan Visit = satu gudang di satu Subcont City.
  if (g.regions.length === 0) e.regions = "Pilih kota gudang.";
  else if (g.regions.length > 1) e.regions = "Satu laporan hanya untuk satu kota. Pilih salah satu.";
  else if (allowedCities && g.regions.some((r) => !allowedCities.includes(r))) e.regions = "Kota tidak termasuk area akun ini.";
  const required: [keyof GudangData, string][] = [
    ["warehouseName", "Warehouse Name"],
    ["pic", "PIC Subcont"],
    ["spv", "YOFC SPV"],
    ["pm", "YOFC PM/RPM"],
  ];
  for (const [key, label] of required) {
    const v = collapseSpaces(String(g[key] ?? ""));
    if (!v) e[key] = `${label} wajib diisi.`;
    else if (v.length > LIMITS.textMax) e[key] = `${label} maksimal ${LIMITS.textMax} karakter.`;
  }
  return e;
}

export interface MaterialFields {
  material: string;
  remark: string;
  quantity: string;
  unit: string;
  notes: string;
}

export type MaterialErrors = Partial<Record<keyof MaterialFields, string>>;

export interface MaterialOptionLike {
  name: string;
  remarks: string[];
  /** Satuan otomatis; null/undefined = dipilih pengguna. */
  unit?: string | null;
}

export function validateMaterialFields(f: MaterialFields, options?: readonly MaterialOptionLike[]): MaterialErrors {
  const e: MaterialErrors = {};
  if (!f.material) e.material = "Pilih material.";
  else if (options) {
    const opt = options.find((o) => o.name === f.material);
    if (!opt) e.material = "Material tidak ada di daftar.";
    else if (!opt.remarks.includes(f.remark)) e.remark = "Pilih remark.";
  }
  if (!f.remark) e.remark = "Pilih remark.";
  if (!f.quantity.trim()) e.quantity = "Quantity wajib diisi.";
  else if (parseQuantity(f.quantity) === null) e.quantity = "Quantity harus angka bulat lebih dari 0, tanpa titik atau koma (contoh: 1200).";
  const unit = collapseSpaces(f.unit);
  const fixedUnit = options?.find((o) => o.name === f.material)?.unit;
  if (!unit) e.unit = "Satuan wajib diisi.";
  else if (unit.length > LIMITS.unitMax) e.unit = `Satuan maksimal ${LIMITS.unitMax} karakter.`;
  else if (fixedUnit && unit !== fixedUnit) e.unit = `Satuan untuk material ini harus "${fixedUnit}".`;
  if (f.notes.length > LIMITS.notesMax) e.notes = `Notes maksimal ${LIMITS.notesMax} karakter.`;
  return e;
}

export function hasErrors(e: object): boolean {
  return Object.values(e).some(Boolean);
}
