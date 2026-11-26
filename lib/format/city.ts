/**
 * Format nama kota untuk tampilan form dan PDF (readme bagian 4A):
 * huruf awal kapital ("PADANG PARIAMAN" → "Padang Pariaman"),
 * kecuali singkatan yang tetap kapital ("DKI JAKARTA" → "DKI Jakarta").
 *
 * Spreadsheet tetap memakai huruf kapital semua; fungsi ini hanya untuk tampilan.
 * Data tidak "diperbaiki" (misalnya KUTAIKERTANEGARA tetap satu kata).
 */

/** Singkatan wilayah yang tetap ditulis kapital. */
export const CITY_ACRONYMS: ReadonlySet<string> = new Set([
  "DKI",
  "DIY",
  "NTB",
  "NTT",
  "NAD",
  "KAB",
  "KAB.",
  "KEP",
  "KEP.",
  "ADM",
  "ADM.",
]);

function capitalizeWord(word: string): string {
  if (CITY_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
  // Kata bertanda hubung: "TOLI-TOLI" → "Toli-Toli"
  return word
    .split("-")
    .map((part) => (part ? part.charAt(0).toLocaleUpperCase("id-ID") + part.slice(1).toLocaleLowerCase("id-ID") : part))
    .join("-");
}

export function toDisplayCity(city: string): string {
  return city
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}
