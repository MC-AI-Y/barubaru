/**
 * Galat akses Google. `message` untuk log server (tanpa rahasia);
 * pengguna hanya melihat pesan umum dari route API.
 */
export class GoogleApiError extends Error {
  readonly status: number;
  /** Kode singkat untuk diagnosis, misalnya "invalid_grant" atau "PERMISSION_DENIED". */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.code = code;
  }
}

/** Pesan diagnosis untuk admin berdasarkan status/kode galat Google. */
export function explainGoogleError(err: GoogleApiError): string {
  if (err.code === "invalid_grant") {
    return "Refresh token tidak valid atau kedaluwarsa. Buat ulang dengan scripts/get-refresh-token.mjs.";
  }
  if (err.code === "invalid_client") {
    return "GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET salah.";
  }
  if (err.status === 403) {
    return "Akun WHControl tidak punya akses ke file ini, atau API belum diaktifkan di Google Cloud.";
  }
  if (err.status === 404) {
    return "File/tab tidak ditemukan. Periksa ID dan nama tab di env, dan pastikan file sudah dikonversi ke Google Sheets.";
  }
  if (err.status === 400 && /not supported/i.test(err.message)) {
    return "File masih berformat Excel (.xlsx). Konversi ke Google Sheets dan pakai ID file hasil konversi.";
  }
  if (err.status === 400 && /Unable to parse range/i.test(err.message)) {
    return "Nama tab tidak ditemukan di spreadsheet. Periksa variabel *_TAB di env.";
  }
  return err.message;
}
