/**
 * Data Dashboard dan penulisan SMDT (hanya server).
 */
import { getResultSheet, getSmdtSheet } from "../env";
import { createTtlCache } from "../google/cache";
import { googleFetch } from "../google/http";
import { quoteTabName, readSheetValues } from "../google/sheets";
import { cellText, nameKey } from "../format/text";
import { invalidateOrders, loadOrders } from "../orders/store";
import type { BoqLine, OrderKind, TransferLine } from "../orders/types";
import { computeStock, hasData, type StockResult } from "./compute";
import { parseVisitReports, type VisitReport } from "./visit";
import { locateSmdtHeader } from "./smdt";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

const visitCache = createTtlCache<{ reports: VisitReport[]; multiCity: number }>(
  async () => parseVisitReports(await readSheetValues(getResultSheet(), "A:Z")),
  { ttlMs: 2 * 60 * 1000, staleMaxMs: 30 * 60 * 1000 },
);

export interface DashboardData {
  result: StockResult;
  multiCityVisits: number;
  warnings: string[];
  computedAt: number;
}

const LABEL: Record<OrderKind, string> = { do: "DO", to: "TO", boq: "BOQ" };

/** Membaca DO, TO, BOQ, Visit, dan riwayat verifikasi lalu menghitung SMDT. Sumber yang gagal dilewati dengan peringatan. */
export async function loadDashboard(refresh = false): Promise<DashboardData> {
  if (refresh) visitCache.invalidate();
  const warnings: string[] = [];
  const kinds: OrderKind[] = ["do", "to", "boq"];
  const loaded = await Promise.all(
    kinds.map(async (k) => {
      try {
        if (refresh) invalidateOrders(k);
        return { data: await loadOrders(k) };
      } catch (err) {
        console.error(`[WHControl] Dashboard: sheet ${LABEL[k]} gagal dibaca:`, err instanceof Error ? err.message : "");
        warnings.push(`Data ${LABEL[k]} tidak bisa dibaca, sehingga belum ikut dihitung.`);
        return { data: { transfer: [] as TransferLine[], boq: [] as BoqLine[], loadedAt: 0 } };
      }
    }),
  );
  let visits: { reports: VisitReport[]; multiCity: number } = { reports: [], multiCity: 0 };
  try {
    visits = await visitCache.get();
  } catch (err) {
    console.error("[WHControl] Dashboard: hasil Visit gagal dibaca:", err instanceof Error ? err.message : "");
    warnings.push("Hasil Visit tidak bisa dibaca, sehingga Inventory Actual kosong.");
  }
  const [d, t, b] = loaded as [(typeof loaded)[number], (typeof loaded)[number], (typeof loaded)[number]];
  const result = computeStock({
    doLines: d.data.transfer ?? [],
    toLines: t.data.transfer ?? [],
    boqLines: b.data.boq ?? [],
    visits: visits.reports,
  });
  return { result, multiCityVisits: visits.multiCity, warnings: [...new Set(warnings)], computedAt: Date.now() };
}

/** Menulis ulang sheet SMDT → Stock mulai baris setelah judul. Remarks dipertahankan per Subcont City + Material. */
export async function writeSmdt(result: StockResult): Promise<{ written: number; remarksKept: number }> {
  const sheet = getSmdtSheet();
  const existing = await readSheetValues(sheet, "A1:M");
  const { headerIndex, remarksCol, cityCol, materialCol } = locateSmdtHeader(existing);
  const remarks = new Map<string, string>();
  if (remarksCol >= 0) {
    for (let i = headerIndex + 1; i < existing.length; i++) {
      const r = existing[i] ?? [];
      const note = cellText(r[remarksCol]);
      if (note) remarks.set(`${nameKey(cellText(r[cityCol]))}|${nameKey(cellText(r[materialCol]))}`, note);
    }
  }

  const rows = result.rows.filter(hasData);
  let kept = 0;
  const values = rows.map((r, i) => {
    const note = remarks.get(`${nameKey(r.subcontCity)}|${nameKey(r.material)}`) ?? "";
    if (note) kept++;
    return [
      i + 1,
      r.subcontCity,
      r.material,
      r.do,
      r.borrow,
      r.totalIn,
      r.boq,
      r.handover,
      r.totalOut,
      r.inventoryByData,
      r.inventoryActual ?? "",
      r.gap ?? "",
      note,
    ];
  });

  const start = headerIndex + 2; // baris data pertama (1-based)
  const base = `${SHEETS_API}/${encodeURIComponent(sheet.spreadsheetId)}/values`;
  const clearRange = `${quoteTabName(sheet.tab)}!A${start}:M`;
  await googleFetch(`${base}/${encodeURIComponent(clearRange)}:clear`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (values.length) {
    const range = `${quoteTabName(sheet.tab)}!A${start}:M${start + values.length - 1}`;
    await googleFetch(
      `${base}/${encodeURIComponent(range)}?valueInputOption=RAW`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values }) },
      { maxRetries: 0 },
    );
  }
  return { written: values.length, remarksKept: kept };
}
