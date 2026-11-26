/**
 * Spreadsheet "WHControl - Verifikasi" (hanya server).
 *
 * - Bila env SHEET_VERIFY_ID diisi, spreadsheet itu yang dipakai.
 * - Bila tidak, dicari di Drive akun WHControl lewat penanda appProperties,
 *   dan dibuat otomatis (tab DO, TO, BOQ beserta judul kolom) bila belum ada.
 * - Tab yang hilang ditambahkan otomatis; judul kolom ditulis bila baris 1 kosong.
 */
import { getVerifySheetIdOverride, type SheetRef } from "../env";
import { escapeDriveQuery, listDriveFiles, MIME_SHEET, updateDriveAppProperties } from "../google/drive";
import { googleFetch } from "../google/http";
import { appendSheetRows, quoteTabName, readSheetRanges } from "../google/sheets";
import { createTtlCache } from "../google/cache";
import { ORDER_KINDS, type OrderKind } from "../orders/types";
import { parseRecords, recordToRow, VERIFY_COLUMNS, VERIFY_HEADER, VERIFY_TAB, type VerificationRecord } from "./records";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const MARKER_KEY = "whcKey";
const MARKER_VALUE = "WHC_VERIFY_SHEET";
export const VERIFY_SHEET_TITLE = "WHControl - Verifikasi (otomatis, jangan ubah judul kolom)";

let idCache: string | null = null;
let idPromise: Promise<string> | null = null;

async function createSpreadsheet(): Promise<string> {
  const header = VERIFY_HEADER.map((h) => ({ userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true } } }));
  const body = {
    properties: { title: VERIFY_SHEET_TITLE, locale: "in_ID", timeZone: "Asia/Jakarta" },
    sheets: ORDER_KINDS.map((k) => ({
      properties: { title: VERIFY_TAB[k], gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header }] }],
    })),
  };
  const res = await googleFetch(
    `${SHEETS_API}?fields=spreadsheetId`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    { maxRetries: 0 },
  );
  const { spreadsheetId } = (await res.json()) as { spreadsheetId: string };
  await updateDriveAppProperties(spreadsheetId, { [MARKER_KEY]: MARKER_VALUE });
  console.info("[WHControl] Spreadsheet Verifikasi dibuat otomatis.");
  return spreadsheetId;
}

/** Memastikan tab DO/TO/BOQ ada dan berjudul kolom (untuk spreadsheet dari env). */
async function ensureTabs(spreadsheetId: string): Promise<void> {
  const res = await googleFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`, { method: "GET" });
  const data = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  const titles = new Set((data.sheets ?? []).map((s) => s.properties?.title ?? ""));
  const missing = ORDER_KINDS.filter((k) => !titles.has(VERIFY_TAB[k]));
  if (missing.length) {
    await googleFetch(
      `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: missing.map((k) => ({ addSheet: { properties: { title: VERIFY_TAB[k], gridProperties: { frozenRowCount: 1 } } } })) }),
      },
      { maxRetries: 0 },
    );
  }
  for (const k of ORDER_KINDS) {
    const ref: SheetRef = { spreadsheetId, tab: VERIFY_TAB[k] };
    const [head] = await readSheetRanges(ref, ["A1:Y1"]);
    if (!head || !head[0] || head[0].every((c) => !c) || head[0].length < VERIFY_HEADER.length) {
      const range = `${quoteTabName(ref.tab)}!A1:Y1`;
      await googleFetch(
        `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [VERIFY_HEADER] }) },
        { maxRetries: 0 },
      );
    }
  }
}

/**
 * Spreadsheet lama belum punya judul kolom PIC Name, PIC Phone, PIC Photo File ID, PIC Photo Link (V–Y).
 * Judul ditulis ulang di baris 1 semua tab (tidak menyentuh data). Gagal di sini tidak menghentikan aplikasi.
 */
async function ensureLatestHeader(spreadsheetId: string): Promise<void> {
  try {
    const data = ORDER_KINDS.map((k) => ({ range: `${quoteTabName(VERIFY_TAB[k])}!A1:Y1`, values: [VERIFY_HEADER] }));
    await googleFetch(
      `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "RAW", data }) },
      { maxRetries: 0 },
    );
  } catch (err) {
    console.warn("[WHControl] Judul kolom spreadsheet Verifikasi gagal diperbarui:", err instanceof Error ? err.message : "");
  }
}

async function resolveId(): Promise<string> {
  const override = getVerifySheetIdOverride();
  if (override) {
    await ensureTabs(override);
    return override;
  }
  const q = `mimeType = '${MIME_SHEET}' and trashed = false and appProperties has { key='${MARKER_KEY}' and value='${escapeDriveQuery(MARKER_VALUE)}' }`;
  const found = await listDriveFiles(q, 5);
  if (found[0]) {
    await ensureLatestHeader(found[0].id);
    return found[0].id;
  }
  return createSpreadsheet();
}

export async function getVerifySpreadsheetId(): Promise<string> {
  if (idCache) return idCache;
  idPromise ??= resolveId()
    .then((id) => {
      idCache = id;
      return id;
    })
    .finally(() => {
      idPromise = null;
    });
  return idPromise;
}

/** Semua catatan verifikasi per jenis. Cache 20 detik; dihapus setiap kali instance ini menulis. */
const recordsCache = createTtlCache<Record<OrderKind, VerificationRecord[]>>(
  async () => {
    const spreadsheetId = await getVerifySpreadsheetId();
    const out = {} as Record<OrderKind, VerificationRecord[]>;
    const tabs = await Promise.all(
      ORDER_KINDS.map((k) => readSheetRanges({ spreadsheetId, tab: VERIFY_TAB[k] }, [VERIFY_COLUMNS]).then((r) => r[0] ?? [])),
    );
    ORDER_KINDS.forEach((k, i) => (out[k] = parseRecords(tabs[i] ?? [], k)));
    return out;
  },
  { ttlMs: 20 * 1000, staleMaxMs: 10 * 60 * 1000 },
);

export async function loadVerifications(kind: OrderKind, fresh = false): Promise<VerificationRecord[]> {
  if (fresh) recordsCache.invalidate();
  return (await recordsCache.get())[kind];
}

/** Memperbarui status satu catatan (keputusan admin). Baris dicari ulang berdasarkan Verification ID. */
export async function updateVerification(
  kind: OrderKind,
  id: string,
  patch: Pick<VerificationRecord, "status" | "reviewedAt" | "reviewedText" | "reviewedBy" | "rejectReason">,
): Promise<void> {
  const spreadsheetId = await getVerifySpreadsheetId();
  const tab = VERIFY_TAB[kind];
  const [values = []] = await readSheetRanges({ spreadsheetId, tab }, [VERIFY_COLUMNS]);
  const record = parseRecords(values, kind).find((r) => r.id === id);
  if (!record) throw new Error("Catatan verifikasi tidak ditemukan.");
  const q = quoteTabName(tab);
  const data = [
    { range: `${q}!G${record.row}`, values: [[patch.status]] },
    { range: `${q}!P${record.row}:R${record.row}`, values: [[patch.reviewedText, patch.reviewedBy, patch.rejectReason]] },
    { range: `${q}!T${record.row}`, values: [[patch.reviewedAt || ""]] },
  ];
  await googleFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "RAW", data }) },
    { maxRetries: 1 },
  );
  recordsCache.invalidate();
}

export async function appendVerification(kind: OrderKind, record: Omit<VerificationRecord, "row" | "kind">): Promise<void> {
  const spreadsheetId = await getVerifySpreadsheetId();
  await appendSheetRows({ spreadsheetId, tab: VERIFY_TAB[kind] }, VERIFY_COLUMNS, [recordToRow(record)]);
  recordsCache.invalidate();
}
