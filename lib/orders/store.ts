/**
 * Membaca sheet DO, TO, BOQ dengan cache singkat (hanya server).
 * Cache 2 menit karena admin mengubah data langsung di Google Sheets.
 */
import { ConfigError, getBoqSheet, getDoSheet, getToSheet, type SheetRef } from "../env";
import { createTtlCache, type TtlCache } from "../google/cache";
import { GoogleApiError } from "../google/errors";
import { SheetFormatError } from "../google/parse";
import { readSheetValues } from "../google/sheets";
import { parseBoqSheet, parseTransferSheet } from "./parse";
import type { BoqLine, OrderKind, TransferLine } from "./types";

export const ORDERS_CACHE_TTL_MS = 2 * 60 * 1000;
const COLUMNS = "A:AZ";

interface Loaded<T> {
  lines: T[];
  loadedAt: number;
}

function cacheFor<T>(label: string, sheet: () => SheetRef, parse: (v: string[][]) => T[]): TtlCache<Loaded<T>> {
  return createTtlCache(
    async () => ({ lines: parse(await readSheetValues(sheet(), COLUMNS)), loadedAt: Date.now() }),
    {
      ttlMs: ORDERS_CACHE_TTL_MS,
      staleMaxMs: 30 * 60 * 1000,
      onStaleServed: (e) =>
        console.warn(`[WHControl] Gagal memperbarui ${label}, memakai cache lama:`, e instanceof Error ? e.message : ""),
    },
  );
}

const caches = {
  do: cacheFor<TransferLine>("sheet DO", getDoSheet, (v) => parseTransferSheet(v, "do")),
  to: cacheFor<TransferLine>("sheet TO", getToSheet, (v) => parseTransferSheet(v, "to")),
  boq: cacheFor<BoqLine>("sheet BOQ", getBoqSheet, parseBoqSheet),
};

export async function loadOrders(kind: OrderKind): Promise<{ transfer?: TransferLine[]; boq?: BoqLine[]; loadedAt: number }> {
  if (kind === "boq") {
    const r = await caches.boq.get();
    return { boq: r.lines, loadedAt: r.loadedAt };
  }
  const r = await caches[kind].get();
  return { transfer: r.lines, loadedAt: r.loadedAt };
}

/** Dipanggil setelah aplikasi menulis ke sheet (Tahap 4) atau saat pengguna menekan Muat ulang. */
export function invalidateOrders(kind: OrderKind): void {
  caches[kind].invalidate();
}

const SHEET_ENV: Record<OrderKind, string> = { do: "SHEET_DO_ID / SHEET_DO_TAB", to: "SHEET_TO_ID / SHEET_TO_TAB", boq: "SHEET_BOQ_ID / SHEET_BOQ_TAB" };
const SHEET_NAME: Record<OrderKind, string> = { do: "DO", to: "TO", boq: "BOQ" };

/**
 * Pesan galat yang bisa ditindaklanjuti admin (tanpa ID atau rahasia).
 * Null bila galatnya umum (pakai pesan "Layanan sedang bermasalah").
 */
export function explainOrdersError(kind: OrderKind, err: unknown): string | null {
  if (err instanceof ConfigError) return `Database ${SHEET_NAME[kind]} belum diatur di server (${SHEET_ENV[kind]}).`;
  if (err instanceof SheetFormatError) return `Format sheet ${SHEET_NAME[kind]} tidak sesuai: ${err.message.replace(/\.$/, "")}. Periksa judul kolom.`;
  if (err instanceof GoogleApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
    return `Sheet ${SHEET_NAME[kind]} tidak bisa dibuka oleh akun WHControl. Periksa ID, nama tab, dan akses berbagi.`;
  }
  return null;
}
