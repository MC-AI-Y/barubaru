import type { IconName } from "@/components/ui/Icon";

/**
 * Daftar layar WHControl (readme bagian 3; Phase 2: Beranda = menu fitur).
 * Urutan array menentukan arah transisi (maju/mundur).
 */
export const SCREEN_ORDER = [
  "home",
  "login",
  "dashboard",
  "do",
  "to",
  "boq",
  "visit",
  "pao",
  "gudang",
  "material",
  "review",
  "pac",
  "submit",
  "done",
] as const;

export type ScreenId = (typeof SCREEN_ORDER)[number];

/** Langkah laporan yang tampil di stepper (setelah login). */
export const REPORT_STEPS = [
  { id: "pao", label: "Selfie Awal" },
  { id: "gudang", label: "Data Gudang" },
  { id: "material", label: "Material" },
  { id: "review", label: "Review" },
  { id: "pac", label: "Foto Penutup" },
  { id: "submit", label: "Kirim" },
  { id: "done", label: "Selesai" },
] as const satisfies readonly { id: ScreenId; label: string }[];

export function screenIndex(id: ScreenId): number {
  return SCREEN_ORDER.indexOf(id);
}

/** Indeks langkah di stepper, atau -1 bila layar bukan bagian dari laporan. */
export function reportStepIndex(id: ScreenId): number {
  return REPORT_STEPS.findIndex((s) => s.id === id);
}

/** Layar sebelumnya untuk tombol "Kembali". null = tidak bisa kembali. */
export const PREVIOUS_SCREEN: Record<ScreenId, ScreenId | null> = {
  home: null,
  login: "home",
  dashboard: "home",
  do: "home",
  to: "home",
  boq: "home",
  visit: "home",
  pao: "visit",
  gudang: "pao",
  material: "gudang",
  review: "material",
  pac: "review",
  submit: null, // proses kirim tidak bisa dibatalkan dengan "Kembali"
  done: null,
};

/** Fitur di Beranda (Phase 2), urut sesuai spesifikasi v5.0. */
export const FEATURES = [
  { id: "dashboard", label: "Dashboard", short: "Dashboard", description: "Ringkasan stok SMDT per Subcont City.", icon: "layoutGrid" },
  { id: "do", label: "DO (Delivery Order)", short: "DO", description: "Verifikasi material yang dikirim ke gudang subcont.", icon: "truck" },
  { id: "to", label: "TO (Transfer Order)", short: "TO", description: "Verifikasi material pindahan antar gudang.", icon: "refresh" },
  { id: "boq", label: "BOQ", short: "BOQ", description: "Verifikasi pemakaian material per site.", icon: "clipboard" },
  { id: "visit", label: "Visit", short: "Visit", description: "Laporan stok gudang subcont dengan foto bukti.", icon: "warehouse" },
] as const satisfies readonly { id: ScreenId; label: string; short: string; description: string; icon: IconName }[];

export type FeatureId = (typeof FEATURES)[number]["id"];

/** Fitur yang sudah aktif (Tahap 2: DO, TO, BOQ tampil; verifikasi menyusul). Lainnya tampil sebagai "Sedang disiapkan". */
export const READY_FEATURES: readonly FeatureId[] = ["dashboard", "do", "to", "boq", "visit"];

/** Layar alur laporan Visit yang membutuhkan draf. */
export const VISIT_REPORT_SCREENS: readonly ScreenId[] = ["pao", "gudang", "material", "review", "pac", "submit"];
