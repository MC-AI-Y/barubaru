/**
 * Menulis ulang SMDT setelah status dokumen menjadi selesai (persetujuan admin DO/TO,
 * atau BOQ yang dipilih subcont). Gagal di sini tidak membatalkan perubahan status. Hanya server.
 */
import { ConfigError } from "../env";
import { loadDashboard, writeSmdt } from "./store";

export async function syncSmdtAfterChange(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await writeSmdt((await loadDashboard(true)).result);
    return { ok: true, message: `SMDT diperbarui (${res.written} baris).` };
  } catch (err) {
    console.warn("[WHControl] SMDT setelah perubahan status:", err instanceof Error ? err.message : "");
    return {
      ok: false,
      message: err instanceof ConfigError ? "SMDT belum diatur, sehingga tidak ikut diperbarui." : "SMDT gagal diperbarui otomatis. Tekan Perbarui SMDT di Dashboard.",
    };
  }
}
