import type { SheetRef } from "../env";
import { googleFetch, type GoogleFetchOptions } from "./http";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/** Nama tab dalam notasi A1: diapit kutip tunggal, kutip di dalamnya digandakan. */
export function quoteTabName(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

/**
 * Membaca nilai sel (sesuai tampilan di Sheets) dari satu tab.
 * Baris kosong di tengah tetap dikembalikan sebagai array kosong;
 * sel kosong di akhir baris tidak disertakan oleh Google (diatasi oleh parser).
 */
export async function readSheetValues(
  sheet: SheetRef,
  columns = "A:Z",
  options: GoogleFetchOptions = {},
): Promise<string[][]> {
  const range = `${quoteTabName(sheet.tab)}!${columns}`;
  const url =
    `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}/values/${encodeURIComponent(range)}` +
    `?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;

  const res = await googleFetch(url, { method: "GET" }, options);
  const data = (await res.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

/** Membaca beberapa rentang sekaligus, misalnya ["A:A", "S:S"]. */
export async function readSheetRanges(
  sheet: SheetRef,
  ranges: readonly string[],
  options: GoogleFetchOptions = {},
): Promise<string[][][]> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(`${quoteTabName(sheet.tab)}!${r}`)}`).join("&");
  const url =
    `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}/values:batchGet?${params}` +
    `&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const res = await googleFetch(url, { method: "GET" }, options);
  const data = (await res.json()) as { valueRanges?: { values?: unknown[][] }[] };
  return (data.valueRanges ?? []).map((vr) =>
    (vr.values ?? []).map((row) => row.map((c) => (c === null || c === undefined ? "" : String(c)))),
  );
}

export type CellValue = string | number;

/**
 * Menambahkan banyak baris dalam SATU permintaan (atomik di sisi Google).
 * valueInputOption=RAW: teks pengguna tidak pernah dijalankan sebagai rumus.
 */
export async function appendSheetRows(
  sheet: SheetRef,
  columns: string,
  rows: CellValue[][],
  options: GoogleFetchOptions = {},
): Promise<string | null> {
  const range = `${quoteTabName(sheet.tab)}!${columns}`;
  const url =
    `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await googleFetch(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values: rows }) },
    // Tidak diulang otomatis: bila status tidak pasti, pengecekan Submission ID
    // saat "Coba Lagi" yang mencegah baris ganda.
    { maxRetries: 0, ...options },
  );
  const data = (await res.json().catch(() => ({}))) as { updates?: { updatedRange?: string } };
  return data.updates?.updatedRange ?? null;
}

/** "'Tab'!A12:T14" → { start: 12, end: 14 } (nomor baris 1-based). */
export function parseUpdatedRows(updatedRange: string | null): { start: number; end: number } | null {
  const m = /![A-Z]+(\d+)(?::[A-Z]+(\d+))?$/.exec(updatedRange ?? "");
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2] ?? m[1]);
  return start > 0 && end >= start ? { start, end } : null;
}

const sheetIdCache = new Map<string, number>();

async function getSheetId(sheet: SheetRef, options: GoogleFetchOptions = {}): Promise<number | null> {
  const key = `${sheet.spreadsheetId}|${sheet.tab}`;
  const cached = sheetIdCache.get(key);
  if (cached !== undefined) return cached;
  const url = `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}?fields=sheets.properties(sheetId,title)`;
  const res = await googleFetch(url, { method: "GET" }, options);
  const data = (await res.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  const found = data.sheets?.find((x) => x.properties?.title === sheet.tab)?.properties?.sheetId;
  if (typeof found !== "number") return null;
  sheetIdCache.set(key, found);
  return found;
}

/**
 * Memberi format angka polos "0" (tanpa pemisah ribuan, tanpa desimal) pada
 * satu kolom untuk baris yang baru ditulis, agar tidak mewarisi format lain
 * dari baris di atasnya. Nilai tetap angka (bisa dijumlah).
 */
export async function formatPlainIntegerColumn(
  sheet: SheetRef,
  rows: { start: number; end: number },
  columnIndex: number,
  options: GoogleFetchOptions = {},
): Promise<void> {
  const sheetId = await getSheetId(sheet, options);
  if (sheetId === null) return;
  const url = `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}:batchUpdate`;
  const body = {
    requests: [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: rows.start - 1, endRowIndex: rows.end, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      },
    ],
  };
  await googleFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, options);
}
