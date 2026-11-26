/**
 * Pembaca database WHControl dari Google Sheets (readme bagian 2) dengan cache 5 menit.
 * Hanya untuk kode server. Isi sheet password tidak pernah dikirim ke browser.
 */
import { getMaterialSheet, getRegionSheet, getUsersSheet } from "../env";
import { createTtlCache } from "./cache";
import { parseMaterials, parseRegions, parseUsers, type MaterialOption, type UserDirectory } from "./parse";
import { readSheetValues } from "./sheets";

/** Masa berlaku cache data referensi (readme: 5–10 menit). */
export const DATABASE_CACHE_TTL_MS = 5 * 60 * 1000;

function warnStale(label: string) {
  return (error: unknown) => {
    console.warn(
      `[WHControl] Gagal memperbarui ${label}, memakai data cache lama:`,
      error instanceof Error ? error.message : "galat tidak dikenal",
    );
  };
}

const usersCache = createTtlCache<UserDirectory>(
  async () => {
    const directory = parseUsers(await readSheetValues(getUsersSheet(), "A:Z"));
    if (directory.conflicts.size > 0) {
      // Hanya jumlah yang dicatat. Nama dan password tidak masuk log.
      console.warn(
        `[WHControl] ${directory.conflicts.size} Subcont Name tercatat ganda dengan password berbeda; login untuk nama tersebut ditolak sampai data dibereskan.`,
      );
    }
    return directory;
  },
  { ttlMs: DATABASE_CACHE_TTL_MS, onStaleServed: warnStale("Username and Password") },
);

const regionsCache = createTtlCache<Map<string, string[]>>(
  async () => parseRegions(await readSheetValues(getRegionSheet(), "A:Z")),
  { ttlMs: DATABASE_CACHE_TTL_MS, onStaleServed: warnStale("Subcont and City Area") },
);

const materialsCache = createTtlCache<MaterialOption[]>(
  async () => parseMaterials(await readSheetValues(getMaterialSheet(), "A:Z")),
  { ttlMs: DATABASE_CACHE_TTL_MS, onStaleServed: warnStale("Material and Remarks") },
);

export function getUserDirectory(): Promise<UserDirectory> {
  return usersCache.get();
}

export function getRegionMap(): Promise<Map<string, string[]>> {
  return regionsCache.get();
}

export function getMaterialOptions(): Promise<MaterialOption[]> {
  return materialsCache.get();
}
