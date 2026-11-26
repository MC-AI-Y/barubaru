/**
 * Utilitas teks yang dipakai server dan klien.
 */

/**
 * Merapikan spasi: buang spasi di awal/akhir dan ganti spasi berurutan
 * (termasuk tab, baris baru, dan spasi tak-putus) menjadi satu spasi.
 */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * Kunci pencocokan Subcont Name (readme bagian 10):
 * tidak membedakan huruf besar/kecil dan mengabaikan spasi berlebih.
 * Normalisasi Unicode NFKC menyamakan karakter yang tampak sama
 * (misalnya huruf lebar penuh dari keyboard tertentu).
 */
export function nameKey(value: string): string {
  return collapseSpaces(value.normalize("NFKC")).toLocaleLowerCase("id-ID");
}

/** Nilai sel spreadsheet menjadi string bersih (tanpa mengubah isi). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return collapseSpaces(String(value));
}
