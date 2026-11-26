/**
 * Sinkron ringkasan draf ke server (pemberitahuan lintas perangkat).
 * Hanya ringkasan: gudang, jumlah material, waktu. Foto TIDAK dikirim.
 * Semua pemanggilan bersifat "best effort": gagal = diam, dicoba lagi pada perubahan berikutnya.
 */
import { apiRequest } from "../api";
import type { Draft } from "./draft";

const DEVICE_KEY = "whc:deviceId";
let memoryDeviceId: string | null = null;

/** ID acak perangkat ini (disimpan di browser, bukan data pribadi). */
export function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && /^[A-Za-z0-9-]{8,64}$/.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
}

/** Draf dianggap "ada isinya" (layak diberitahukan ke perangkat lain). */
export function draftHasContent(d: Draft | null): d is Draft {
  return Boolean(d && (d.pao || d.materials.length || d.form.photo || d.gudang.warehouseName.trim()));
}

export interface RemoteDraft {
  submissionId: string;
  device: string;
  warehouse: string;
  materialCount: number;
  createdAt: number;
  updatedAt: number;
}

export const draftStatusApi = {
  report: (d: Draft) =>
    apiRequest<{ ok: true }>("/api/draft/status", {
      method: "PUT",
      body: JSON.stringify({
        submissionId: d.submissionId,
        deviceId: getDeviceId(),
        warehouse: d.gudang.warehouseName,
        materialCount: d.materials.length,
        createdAt: d.createdAt,
      }),
    }),
  remove: (submissionId: string) =>
    apiRequest<{ ok: true }>("/api/draft/status", { method: "DELETE", body: JSON.stringify({ submissionId }) }),
  list: (localSubmissionId?: string | null) => {
    const q = new URLSearchParams({ deviceId: getDeviceId() });
    if (localSubmissionId) q.set("local", localSubmissionId);
    return apiRequest<{ drafts: RemoteDraft[] }>(`/api/draft/status?${q.toString()}`);
  },
};
