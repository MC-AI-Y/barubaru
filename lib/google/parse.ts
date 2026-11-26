/**
 * Pengolah data mentah dari Google Sheets menjadi struktur datar.
 * Murni (tanpa akses jaringan) sehingga mudah diuji.
 */
import { cellText, nameKey } from "../format/text";

export class SheetFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetFormatError";
  }
}

/** Mencari indeks kolom berdasarkan nama header (tidak peka huruf/spasi). */
/**
 * Nama lain yang diterima untuk sebuah judul kolom. Database Phase 2 mengganti
 * judul "Subcont Name" menjadi "Subcont"; keduanya diterima.
 */
export const HEADER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Subcont Name": ["Subcont"],
};

/** Apakah judul kolom `actual` cocok dengan `expected` (termasuk nama lain). */
export function headerNameMatches(actual: string, expected: string): boolean {
  const a = nameKey(actual);
  return [expected, ...(HEADER_ALIASES[expected] ?? [])].some((n) => nameKey(n) === a);
}

export function findColumns<const K extends string>(
  header: readonly string[] | undefined,
  wanted: readonly K[],
  sheetLabel: string,
): Record<K, number> {
  const normalized = (header ?? []).map((h) => nameKey(h));
  const result = {} as Record<K, number>;
  for (const name of wanted) {
    const candidates = [name, ...(HEADER_ALIASES[name] ?? [])].map((n) => nameKey(n));
    const idx = normalized.findIndex((h) => candidates.includes(h));
    if (idx < 0) {
      throw new SheetFormatError(`Kolom "${name}" tidak ditemukan di baris header ${sheetLabel}.`);
    }
    result[name] = idx;
  }
  return result;
}

/**
 * Mengisi ke bawah (forward-fill) kolom yang memakai sel gabungan:
 * sel kosong mewarisi nilai terakhir yang terisi di atasnya, sama seperti
 * sel gabungan di Sheets. Baris yang seluruhnya kosong dibiarkan kosong
 * (dilewati oleh parser) tanpa memutus pewarisan.
 */
export function forwardFill(rows: readonly (readonly string[])[], column: number): string[][] {
  let last = "";
  return rows.map((row) => {
    const copy = [...row];
    if (copy.every((c) => cellText(c) === "")) return copy;
    const value = cellText(copy[column]);
    if (value) {
      last = value;
    } else {
      while (copy.length <= column) copy.push("");
      copy[column] = last;
    }
    return copy;
  });
}

// ── Username and Password ────────────────────────────────────

export interface UserRecord {
  /** Subcont Name persis seperti di database (spasi berlebih dirapikan). */
  name: string;
  /** Password apa adanya dari sel (dicocokkan persis). */
  password: string;
}

export interface UserDirectory {
  /** Kunci = nameKey(Subcont Name). */
  users: Map<string, UserRecord>;
  /** Nama yang muncul ganda dengan password BERBEDA: login untuk nama ini ditolak. */
  conflicts: Set<string>;
  /** Jumlah baris ganda identik yang diabaikan. */
  duplicatesIgnored: number;
}

export const USERS_HEADERS = ["Subcont Name", "Password"] as const;

/**
 * Baris ganda identik (nama + password sama) diabaikan.
 * Nama sama dengan password berbeda ditandai konflik dan tidak bisa login,
 * karena sistem tidak boleh menebak password mana yang benar.
 */
export function parseUsers(values: readonly (readonly string[])[]): UserDirectory {
  const [header, ...rows] = values;
  const col = findColumns(header, USERS_HEADERS, "Username and Password");
  const users = new Map<string, UserRecord>();
  const conflicts = new Set<string>();
  let duplicatesIgnored = 0;

  for (const row of rows) {
    const name = cellText(row[col["Subcont Name"]]);
    // Password tidak dirapikan: dicocokkan persis seperti tertulis di sel.
    const password = row[col.Password] ?? "";
    if (!name || password === "") continue;

    const key = nameKey(name);
    const existing = users.get(key);
    if (!existing) {
      users.set(key, { name, password });
    } else if (existing.password === password) {
      duplicatesIgnored++;
    } else {
      conflicts.add(key);
    }
  }

  for (const key of conflicts) users.delete(key);
  return { users, conflicts, duplicatesIgnored };
}

// ── Subcont and City Area ────────────────────────────────────

export const REGION_HEADERS = ["Subcont Name", "City"] as const;

/**
 * Peta nameKey(Subcont Name) → daftar kota (huruf kapital seperti di database),
 * urutan mengikuti database, tanpa duplikat.
 */
export function parseRegions(values: readonly (readonly string[])[]): Map<string, string[]> {
  const [header, ...rows] = values;
  const col = findColumns(header, REGION_HEADERS, "Subcont and City Area");
  const filled = forwardFill(rows, col["Subcont Name"]);
  const result = new Map<string, string[]>();

  for (const row of filled) {
    const name = cellText(row[col["Subcont Name"]]);
    const city = cellText(row[col.City]);
    if (!name || !city) continue;
    const key = nameKey(name);
    const list = result.get(key) ?? [];
    if (!list.includes(city)) list.push(city);
    result.set(key, list);
  }
  return result;
}

// ── Material and Remarks ─────────────────────────────────────

export const MATERIAL_HEADERS = ["Material", "Remark"] as const;

/** Remark otomatis untuk material yang tidak punya pilihan Remark (readme bagian 4B). */
export const NO_REMARK = "-";

/** Satuan otomatis (readme bagian 4B). */
export const UNIT_METER = "M";
export const UNIT_PIECE = "Pcs";

/**
 * Satuan otomatis dari nama material (tanpa membedakan huruf besar/kecil):
 * semua jenis kabel (memuat "CABLE" atau "KABEL") dan HDPE = "M",
 * selain itu = "Pcs".
 */
export function unitFor(material: string): string {
  const name = material.toUpperCase();
  return /CABLE|KABEL|HDPE/.test(name) ? UNIT_METER : UNIT_PIECE;
}

export interface MaterialOption {
  /** Nama material apa adanya (boleh memuat koma, kutip, garis miring). */
  name: string;
  /** Pilihan remark; ["-"] bila material tidak punya remark. */
  remarks: string[];
  /** Satuan otomatis: "M" (kabel/HDPE) atau "Pcs". */
  unit: string;
}

export function parseMaterials(values: readonly (readonly string[])[]): MaterialOption[] {
  const [header, ...rows] = values;
  const col = findColumns(header, MATERIAL_HEADERS, "Material and Remarks");
  const filled = forwardFill(rows, col.Material);
  const order: string[] = [];
  const byName = new Map<string, string[]>();

  for (const row of filled) {
    const name = cellText(row[col.Material]);
    if (!name) continue;
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    const remark = cellText(row[col.Remark]);
    const list = byName.get(name)!;
    if (remark && remark !== NO_REMARK && !list.includes(remark)) list.push(remark);
  }

  return order.map((name) => {
    const remarks = byName.get(name) ?? [];
    return { name, remarks: remarks.length > 0 ? remarks : [NO_REMARK], unit: unitFor(name) };
  });
}
