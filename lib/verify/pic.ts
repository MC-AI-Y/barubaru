/**
 * PIC penerima barang pada verifikasi DO/TO/BOQ (revisi 26 Nov 2026). Murni.
 */

/** "0812-3456 7890" → "081234567890"; "+62 812…" → "+62812…". null bila bukan nomor telepon wajar. */
export function normalizePhone(value: string): string | null {
  const v = value.replace(/[\s().-]/g, "");
  return /^\+?\d{8,15}$/.test(v) ? v : null;
}

/** Isi kolom PIC Name di sheet: "Nama (telepon)". */
export function picCell(name: string, phone: string): string {
  return `${name} (${phone})`;
}
