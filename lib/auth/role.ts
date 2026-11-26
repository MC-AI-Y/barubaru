/**
 * Peran pengguna WHControl (Phase 2).
 * Akun dengan username "admin" di sheet Username and Password adalah admin;
 * akun lain adalah subcont. Tidak membedakan huruf besar/kecil dan spasi berlebih.
 */
import { nameKey } from "../format/text";

export type Role = "admin" | "subcont";

export const ADMIN_USERNAME = "admin";

export function roleOf(subcontName: string): Role {
  return nameKey(subcontName) === nameKey(ADMIN_USERNAME) ? "admin" : "subcont";
}

/** Pesan untuk fitur yang khusus subcont (misalnya Visit). */
export const SUBCONT_ONLY_MESSAGE = "Fitur ini khusus akun subcont. Akun admin tidak membuat laporan Visit.";
