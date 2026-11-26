/**
 * Format daftar Region (readme bagian 4A):
 *  - 1 kota : "Bogor"                       / "BOGOR"
 *  - 2 kota : "Bogor dan Depok"             / "BOGOR DAN DEPOK"            (tanpa koma)
 *  - ≥3 kota: "Bogor, Depok, dan Cibubur"   / "BOGOR, DEPOK, DAN CIBUBUR"
 * Mode "display" untuk form dan PDF (huruf awal kapital, singkatan tetap kapital),
 * mode "sheet" untuk spreadsheet (huruf kapital semua, termasuk "DAN").
 */
import { toDisplayCity } from "./city";

export type RegionFormat = "display" | "sheet";

export function joinIndonesianList(items: readonly string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

export function formatRegionList(cities: readonly string[], mode: RegionFormat): string {
  const clean = cities.map((c) => c.trim()).filter(Boolean);
  if (mode === "sheet") {
    return joinIndonesianList(
      clean.map((c) => c.toLocaleUpperCase("id-ID")),
      "DAN",
    );
  }
  return joinIndonesianList(clean.map(toDisplayCity), "dan");
}

/** Mengurutkan pilihan kota mengikuti urutan di database akun. */
export function orderByDatabase(selected: readonly string[], databaseOrder: readonly string[]): string[] {
  const set = new Set(selected);
  return databaseOrder.filter((c) => set.has(c));
}
