/**
 * Menulis kolom Verified, PIC Name, dan Photo Evidence PIC di sheet DO/TO/BOQ asli (hanya server).
 * Baris dicari ulang dari data TERBARU berdasarkan kunci dokumen, bukan nomor baris lama,
 * agar aman walau admin menyisipkan atau mengurutkan baris (spesifikasi v5.0 bagian 11).
 */
import { getBoqSheet, getDoSheet, getToSheet, type SheetRef } from "../env";
import { googleFetch } from "../google/http";
import { quoteTabName, readSheetValues } from "../google/sheets";
import { BOQ_HEADERS, DOC_NUMBER_HEADER, locateHeader, TRANSFER_HEADERS } from "./parse";
import type { OrderKind } from "./types";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetOf(kind: OrderKind): SheetRef {
  return kind === "do" ? getDoSheet() : kind === "to" ? getToSheet() : getBoqSheet();
}

export interface DocumentCells {
  /** Nilai kolom Verified, mis. RECEIVED / APPROVED / NEED CHECK (DO/TO) atau APD / ABD / RFSC / FO CUT/VANDALISME (BOQ). */
  verified?: string;
  /** Kolom PIC Name: nama + telepon PIC penerima. */
  picName?: string;
  /** Kolom Photo Evidence PIC: link foto orang yang meminta verifikasi. */
  picPhoto?: string;
  /** Kolom Photo Evidence: link foto barang / surat jalan. */
  evidence?: string;
}

/**
 * Menulis sel dokumen (semua baris material) di sheet asli. Kolom dicari dari judulnya.
 * Bila kolom yang perlu ditulis tidak ada, galat menyebut nama kolomnya (SheetFormatError).
 */
export async function writeDocumentCells(kind: OrderKind, rows: readonly number[], cells: DocumentCells): Promise<number> {
  if (rows.length === 0) return 0;
  const sheet = sheetOf(kind);
  const top = await readSheetValues(sheet, "A1:AZ10");
  const needed = (["verified", "picName", "picPhoto", "evidence"] as const).filter((k) => cells[k] !== undefined);
  const label = `sheet ${kind.toUpperCase()}`;
  const { cols } =
    kind === "boq"
      ? locateHeader(top, BOQ_HEADERS, "siteName", [...needed], label)
      : locateHeader(top, { docNumber: DOC_NUMBER_HEADER[kind], ...TRANSFER_HEADERS }, "docNumber", [...needed], label);
  const data: { range: string; values: string[][] }[] = [];
  for (const key of needed) {
    const letter = columnLetter(cols[key]);
    for (const r of rows) data.push({ range: `${quoteTabName(sheet.tab)}!${letter}${r}`, values: [[cells[key] ?? ""]] });
  }
  await googleFetch(
    `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}/values:batchUpdate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "RAW", data }) },
    { maxRetries: 1 },
  );
  return rows.length;
}
