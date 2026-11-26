/**
 * Tata letak sheet SMDT → Stock. Murni (tanpa jaringan).
 */
import { cellText, nameKey } from "../format/text";

/** Judul kolom SMDT A–M (header di baris 2, kelompok judul di baris 1). */
export const SMDT_HEADER = [
  "No",
  "Subcont City",
  "Material Name",
  "DO",
  "Borrow",
  "TOTAL In",
  "BOQ",
  "Handover",
  "Total Use/Out",
  "Inventory By Data",
  "Inventory Actual",
  "GAP",
  "Remarks",
] as const;

/** Mencari baris judul SMDT (baris yang memuat Subcont City dan Material Name) dan kolom Remarks. */
export function locateSmdtHeader(values: readonly (readonly string[])[]): { headerIndex: number; remarksCol: number; cityCol: number; materialCol: number } {
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = (values[i] ?? []).map((c) => nameKey(cellText(c)));
    const cityCol = row.indexOf("subcont city");
    const materialCol = row.indexOf("material name");
    if (cityCol >= 0 && materialCol >= 0) return { headerIndex: i, remarksCol: row.indexOf("remarks"), cityCol, materialCol };
  }
  return { headerIndex: 1, remarksCol: 12, cityCol: 1, materialCol: 2 };
}

