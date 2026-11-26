/**
 * Status draf lintas perangkat (pemberitahuan saja).
 *
 * Draf dan foto tetap HANYA di perangkat pembuatnya. Server hanya menyimpan
 * ringkasan kecil (gudang, jumlah material, waktu, jenis perangkat) agar
 * perangkat lain yang login dengan akun sama bisa diberi tahu bahwa ada
 * laporan yang belum terkirim.
 *
 * Ringkasan disimpan sebagai appProperties pada file kosong di Drive
 * (batas Drive: kunci + nilai maks. 124 byte per properti).
 */

/** Ringkasan yang dikirim perangkat. */
export interface DraftStatusInput {
  submissionId: string;
  deviceId: string;
  warehouse: string;
  materialCount: number;
  createdAt: number;
}

/** Ringkasan yang ditampilkan di perangkat lain. */
export interface DraftStatus {
  submissionId: string;
  deviceId: string;
  device: string;
  warehouse: string;
  materialCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Ringkasan yang lebih lama dari ini tidak ditampilkan lagi. */
export const DRAFT_STATUS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/;

/** Potong teks agar muat dalam `maxBytes` byte UTF-8 tanpa memotong karakter. */
export function truncateBytes(value: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(value).length <= maxBytes) return value;
  let out = "";
  for (const ch of value) {
    if (enc.encode(out + ch).length > maxBytes) break;
    out += ch;
  }
  return out;
}

/** Validasi + normalisasi kiriman perangkat. Mengembalikan null bila tidak sah. */
export function parseDraftStatusInput(body: unknown, now: number): DraftStatusInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const submissionId = String(b.submissionId ?? "").toLowerCase();
  const deviceId = String(b.deviceId ?? "");
  const materialCount = Number(b.materialCount ?? 0);
  const createdAt = Number(b.createdAt ?? 0);
  if (!UUID_RE.test(submissionId) || !DEVICE_RE.test(deviceId)) return null;
  if (!Number.isInteger(materialCount) || materialCount < 0 || materialCount > 10000) return null;
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
  const warehouse = typeof b.warehouse === "string" ? b.warehouse.replace(/\s+/g, " ").trim() : "";
  return {
    submissionId,
    deviceId,
    warehouse: truncateBytes(warehouse, 100),
    materialCount,
    // Waktu dari perangkat tidak boleh di masa depan.
    createdAt: Math.min(Math.floor(createdAt), now),
  };
}

/** Label perangkat singkat dari User-Agent, misalnya "Android · Chrome". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const os = /iPad/i.test(ua)
    ? "iPad"
    : /iPhone|iPod/i.test(ua)
      ? "iPhone"
      : /Android/i.test(ua)
        ? "Android"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(ua)
            ? "Mac"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Perangkat";
  const browser = /SamsungBrowser/i.test(ua)
    ? "Samsung Internet"
    : /EdgA?\//i.test(ua)
      ? "Edge"
      : /OPR\/|Opera/i.test(ua)
        ? "Opera"
        : /Firefox|FxiOS/i.test(ua)
          ? "Firefox"
          : /Chrome|CriOS/i.test(ua)
            ? "Chrome"
            : /Safari/i.test(ua)
              ? "Safari"
              : "";
  return browser ? `${os} · ${browser}` : os;
}

/** Kunci appProperties. */
export const DRAFT_PROP = {
  key: "whcKey",
  sub: "whcSub",
  sid: "whcSid",
  dev: "whcDev",
  label: "whcLbl",
  warehouse: "whcWh",
  count: "whcMc",
  created: "whcCr",
  updated: "whcUp",
} as const;

export function draftStatusKey(submissionId: string): string {
  return `DRAFT:${submissionId}`;
}

export function toDraftProps(input: DraftStatusInput, args: { subKey: string; device: string; now: number }): Record<string, string> {
  return {
    [DRAFT_PROP.key]: draftStatusKey(input.submissionId),
    [DRAFT_PROP.sub]: args.subKey,
    [DRAFT_PROP.sid]: input.submissionId,
    [DRAFT_PROP.dev]: input.deviceId,
    [DRAFT_PROP.label]: truncateBytes(args.device, 60),
    [DRAFT_PROP.warehouse]: input.warehouse,
    [DRAFT_PROP.count]: String(input.materialCount),
    [DRAFT_PROP.created]: String(input.createdAt),
    [DRAFT_PROP.updated]: String(args.now),
  };
}

export function fromDraftProps(props: Record<string, string> | undefined): DraftStatus | null {
  if (!props) return null;
  const submissionId = props[DRAFT_PROP.sid] ?? "";
  const deviceId = props[DRAFT_PROP.dev] ?? "";
  if (!UUID_RE.test(submissionId) || !deviceId) return null;
  return {
    submissionId,
    deviceId,
    device: props[DRAFT_PROP.label] || "Perangkat lain",
    warehouse: props[DRAFT_PROP.warehouse] ?? "",
    materialCount: Number(props[DRAFT_PROP.count]) || 0,
    createdAt: Number(props[DRAFT_PROP.created]) || 0,
    updatedAt: Number(props[DRAFT_PROP.updated]) || 0,
  };
}

/**
 * Daftar yang ditampilkan: milik perangkat lain, bukan draf yang sedang
 * dibuka di perangkat ini, dan belum terlalu lama. Terbaru di atas.
 */
export function visibleDraftStatuses(all: DraftStatus[], args: { deviceId: string; localSubmissionId?: string | null; now: number }): DraftStatus[] {
  return all
    .filter((s) => s.deviceId !== args.deviceId)
    .filter((s) => !args.localSubmissionId || s.submissionId !== args.localSubmissionId)
    .filter((s) => args.now - s.updatedAt <= DRAFT_STATUS_MAX_AGE_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
