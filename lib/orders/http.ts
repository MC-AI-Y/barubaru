/**
 * Bantuan untuk API DO/TO/BOQ (hanya server).
 */
import type { NextResponse } from "next/server";
import { jsonError, serverErrorResponse } from "../auth/server";
import { explainOrdersError } from "./store";
import type { HistoryIndex } from "./access";
import { indexByKey } from "../verify/records";
import { loadVerifications } from "../verify/store";
import type { OrderKind, OrderView } from "./types";

export function parseKind(value: string | null): OrderKind | null {
  return value === "do" || value === "to" || value === "boq" ? value : null;
}

export function parseView(value: string | null): OrderView {
  return value === "waiting" || value === "verified" || value === "all" ? value : "todo";
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}

/** Galat sheet DO/TO/BOQ: tampilkan pesan yang bisa ditindaklanjuti bila ada. */
export function ordersErrorResponse(kind: OrderKind, err: unknown): NextResponse {
  const explained = explainOrdersError(kind, err);
  const generic = serverErrorResponse(err, `Database ${kind.toUpperCase()}`); // mencatat ke log
  return explained ? jsonError(503, explained) : generic;
}

/**
 * Riwayat verifikasi per dokumen. Bila spreadsheet Verifikasi gagal dibaca,
 * daftar tetap tampil (status dari kolom Verified saja) dengan peringatan.
 */
export async function loadHistory(kind: OrderKind, fresh = false): Promise<{ history: HistoryIndex; warning: string | null }> {
  try {
    return { history: indexByKey(await loadVerifications(kind, fresh)), warning: null };
  } catch (err) {
    console.error("[WHControl] Spreadsheet Verifikasi gagal dibaca:", err instanceof Error ? err.message : "");
    return { history: new Map(), warning: "Status verifikasi (Menunggu Admin/Ditolak) sementara tidak bisa dimuat. Coba Muat ulang." };
  }
}
