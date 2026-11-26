/**
 * Pembaca Environment Variables (hanya untuk kode server).
 *
 * Setiap fitur hanya meminta variabel yang ia butuhkan, sehingga variabel
 * untuk tahap berikutnya (misalnya folder foto) tidak membuat login gagal.
 * Pesan galat menyebut NAMA variabel, tidak pernah nilainya.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function read(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new ConfigError(`Environment variable ${name} belum diisi.`);
  }
  return value.trim();
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: read("GOOGLE_CLIENT_ID"),
    clientSecret: read("GOOGLE_CLIENT_SECRET"),
    refreshToken: read("GOOGLE_REFRESH_TOKEN"),
  };
}

export interface SheetRef {
  /** ID spreadsheet (Google Sheets asli). */
  spreadsheetId: string;
  /** Nama tab di dalam spreadsheet. */
  tab: string;
}

export function getUsersSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_USERS_ID"), tab: read("SHEET_USERS_TAB") };
}

export function getRegionSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_REGION_ID"), tab: read("SHEET_REGION_TAB") };
}

export function getMaterialSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_MATERIAL_ID"), tab: read("SHEET_MATERIAL_TAB") };
}

/** Database Phase 2: DO, TO, BOQ (diisi admin di Google Sheets; aplikasi membaca + menulis kolom Verified). */
export function getDoSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_DO_ID"), tab: read("SHEET_DO_TAB") };
}

export function getToSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_TO_ID"), tab: read("SHEET_TO_TAB") };
}

export function getBoqSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_BOQ_ID"), tab: read("SHEET_BOQ_TAB") };
}

/** Spreadsheet SMDT → tab Stock (rekap hasil hitung Dashboard). */
export function getSmdtSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_SMDT_ID"), tab: read("SHEET_SMDT_TAB") };
}

/**
 * Folder foto verifikasi DO/TO/BOQ (revisi 26 Nov 2026, 2 foto):
 *   Evidence DO/TO/BOQ  = foto barang / surat jalan  (DRIVE_FOLDER_EVIDENCE_DO/TO/BOQ_ID)
 *   Photo PIC DO/TO/BOQ = foto orang yang meminta verifikasi (DRIVE_FOLDER_PIC_DO/TO/BOQ_ID)
 */
export function getEvidenceFolder(kind: "do" | "to" | "boq"): string {
  return read(`DRIVE_FOLDER_EVIDENCE_${kind.toUpperCase()}_ID`);
}

export function getPicFolder(kind: "do" | "to" | "boq"): string {
  return read(`DRIVE_FOLDER_PIC_${kind.toUpperCase()}_ID`);
}

/** Folder yang boleh berisi foto verifikasi jenis ini (untuk menampilkan foto lama dan baru). */
export function getVerifyFolders(kind: "do" | "to" | "boq"): string[] {
  const k = kind.toUpperCase();
  return [process.env[`DRIVE_FOLDER_EVIDENCE_${k}_ID`], process.env[`DRIVE_FOLDER_PIC_${k}_ID`]]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
}

/** Opsional: spreadsheet Verifikasi tertentu. Bila kosong, dibuat dan dicari otomatis di My Drive akun WHControl. */
export function getVerifySheetIdOverride(): string | null {
  const v = process.env.SHEET_VERIFY_ID;
  return v && v.trim() ? v.trim() : null;
}

export function getResultSheet(): SheetRef {
  return { spreadsheetId: read("SHEET_RESULT_ID"), tab: read("SHEET_RESULT_TAB") };
}

export interface DriveFolders {
  pao: string;
  pac: string;
  evidence: string;
  form: string;
}

export function getDriveFolders(): DriveFolders {
  return {
    pao: read("DRIVE_FOLDER_PAO_ID"),
    pac: read("DRIVE_FOLDER_PAC_ID"),
    evidence: read("DRIVE_FOLDER_EVIDENCE_ID"),
    form: read("DRIVE_FOLDER_FORM_ID"),
  };
}

/** Email kontak untuk User-Agent Nominatim (aturan pemakaian OpenStreetMap). */
export function getGeocodeContactEmail(): string {
  return read("GEOCODE_CONTACT_EMAIL");
}

/** Kunci penanda sesi. Minimal 32 karakter agar tidak mudah ditebak. */
export function getJwtSecret(): string {
  const secret = read("JWT_SECRET");
  if (secret.length < 32) {
    throw new ConfigError("JWT_SECRET terlalu pendek (minimal 32 karakter).");
  }
  return secret;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
