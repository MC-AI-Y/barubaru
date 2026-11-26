/**
 * Nilai kolom Verified di sheet DO/TO/BOQ (revisi v5.3, 26 Nov 2026).
 * Kolom Verified adalah status resmi; aplikasi hanya menampilkan nilai yang ada di database.
 *
 *   DO  : (kosong) / ON DELIVERY → RECEIVED (subcont kirim 2 foto) → APPROVED (admin setuju)
 *                                                                  → NEED CHECK (admin tolak; subcont kirim ulang)
 *   TO  : (kosong) → RECEIVED → APPROVED / NEED CHECK
 *   BOQ : (kosong) → subcont memilih salah satu: APD, ABD, RFSC, FO CUT/VANDALISME (selesai; admin hanya melihat)
 */
import { cellText, nameKey } from "../format/text";
import type { OrderKind } from "./types";

export interface StatusSet {
  /** Nilai "belum diverifikasi subcont" selain sel kosong (mis. ON DELIVERY). Ditampilkan sebagai chip. */
  open: readonly string[];
  /** Ditulis saat subcont mengirim verifikasi. Null = tidak ada tahap menunggu admin (BOQ). */
  pending: string | null;
  /** Nilai selesai. DO/TO: [0] ditulis saat admin Setujui. BOQ: pilihan subcont saat mengirim. */
  approved: readonly string[];
  /** Ditulis saat admin Tolak. Null = tidak ada penolakan (BOQ). */
  rejected: string | null;
}

export const STATUS_VALUES: Record<OrderKind, StatusSet> = {
  do: { open: ["ON DELIVERY"], pending: "RECEIVED", approved: ["APPROVED"], rejected: "NEED CHECK" },
  to: { open: [], pending: "RECEIVED", approved: ["APPROVED"], rejected: "NEED CHECK" },
  boq: { open: [], pending: null, approved: ["APD", "ABD", "RFSC", "FO CUT/VANDALISME"], rejected: null },
};

/** Pilihan kolom Verified BOQ yang dipilih subcont saat verifikasi. */
export const BOQ_CHOICES: readonly string[] = STATUS_VALUES.boq.approved;

/** Nilai yang ditulis saat admin menyetujui DO/TO. */
export function approvedValue(kind: OrderKind): string {
  return STATUS_VALUES[kind].approved[0]!;
}

/** True bila jenis dokumen ini melewati keputusan admin (DO/TO). BOQ selesai saat subcont mengirim. */
export function needsAdminDecision(kind: OrderKind): boolean {
  return STATUS_VALUES[kind].pending !== null;
}

/**
 * Nilai lama (sebelum v5.3) yang masih dikenali agar data lama tetap terhitung:
 * DO/TO WAIT ADMIN / VERIFIED / REJECTED, teks "Verified", dan centang TRUE.
 */
const LEGACY: Record<OrderKind, { pending: string[]; approved: string[]; rejected: string[] }> = {
  do: { pending: ["WAIT ADMIN"], approved: ["VERIFIED", "TRUE"], rejected: ["REJECTED"] },
  to: { pending: ["WAIT ADMIN"], approved: ["VERIFIED", "TRUE"], rejected: ["REJECTED"] },
  boq: { pending: [], approved: ["VERIFIED", "TRUE"], rejected: [] },
};

/** Pembanding: huruf kecil, tanpa spasi (FO CUT / VANDALISME = FO CUT/VANDALISME). */
function key(value: string): string {
  return nameKey(cellText(value)).replace(/\s+/g, "");
}

function inList(v: string, list: readonly (string | null)[]): boolean {
  return list.some((x) => x !== null && key(x) === v);
}

/** Nilai pilihan BOQ dalam ejaan resmi, atau null bila bukan salah satu pilihan. */
export function normalizeBoqChoice(value: string): string | null {
  const v = key(value);
  return BOQ_CHOICES.find((c) => key(c) === v) ?? null;
}

export type RowState = "open" | "pending" | "approved" | "rejected" | "other";

/** Menggolongkan isi sel Verified. Nilai lain yang tidak dikenal = "other" (ditampilkan apa adanya, dianggap belum selesai). */
export function rowState(kind: OrderKind, value: string): RowState {
  const v = key(value);
  if (!v || v === "false") return "open";
  const set = STATUS_VALUES[kind];
  const old = LEGACY[kind];
  if (inList(v, set.open)) return "open";
  if (inList(v, [set.pending, ...old.pending])) return "pending";
  if (inList(v, [...set.approved, ...old.approved])) return "approved";
  if (inList(v, [set.rejected, ...old.rejected])) return "rejected";
  return "other";
}

/** Status satu dokumen dari semua barisnya. Label = nilai database yang ditampilkan (kosong bila sel kosong). */
export function documentState(kind: OrderKind, values: readonly string[]): { state: RowState; label: string; partial: boolean } {
  const states = values.map((v) => rowState(kind, v));
  const approved = states.filter((s) => s === "approved").length;
  const raw = (s: RowState) => cellText(values.find((v, i) => states[i] === s && cellText(v)) ?? "").toUpperCase();
  if (approved === states.length && approved > 0) return { state: "approved", label: raw("approved"), partial: false };
  const partial = approved > 0;
  if (states.includes("pending")) return { state: "pending", label: raw("pending"), partial };
  if (states.includes("rejected")) return { state: "rejected", label: raw("rejected"), partial };
  if (states.includes("other")) return { state: "other", label: raw("other"), partial };
  return { state: "open", label: raw("open"), partial };
}
