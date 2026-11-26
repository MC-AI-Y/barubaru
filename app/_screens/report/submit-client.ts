/**
 * Proses kirim di browser (readme bagian 8):
 *   1. unggah semua foto satu per satu (3 paralel), ulang otomatis per file;
 *   2. SETELAH semua sukses → /api/submit (PDF + tulis semua baris sekaligus).
 * Bukti unggah disimpan ke draf, sehingga "Coba Lagi" melanjutkan dari file yang belum terunggah.
 */
import { parseQuantity } from "@/lib/report/validate";
import type { PhotoKind, SubmitPayload, SubmitPhoto, SubmitResult, UploadReceipt } from "@/lib/report/types";
import { UnauthorizedError } from "./capture-client";
import type { Draft, PhotoRef } from "./draft";

export interface SubmitProgress {
  phase: "upload" | "finalize" | "done";
  uploaded: number;
  total: number;
  label: string;
}

export interface SubmitDeps {
  getPhotoBlob: (id: string) => Promise<Blob | null>;
  /** Simpan bukti unggah ke draf (persisten). */
  saveReceipt: (photoId: string, receipt: UploadReceipt) => void;
  onProgress: (p: SubmitProgress) => void;
}

export class SubmitError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "SubmitError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UPLOAD_RETRIES = [1000, 3000, 6000];
const CONCURRENCY = 3;

interface UploadTask {
  photo: PhotoRef;
  kind: PhotoKind;
  index: number;
  material?: string;
  label: string;
}

async function uploadOnce(task: UploadTask, submissionId: string, blob: Blob): Promise<UploadReceipt> {
  const form = new FormData();
  form.append("file", blob, `${task.photo.id}.jpg`);
  form.append(
    "meta",
    JSON.stringify({
      submissionId,
      kind: task.kind,
      photoId: task.photo.id,
      index: task.index,
      material: task.material,
      capture: task.photo.capture,
    }),
  );
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new SubmitError("Koneksi terputus saat mengunggah foto.", true);
  }
  if (res.status === 401) throw new UnauthorizedError();
  const data = (await res.json().catch(() => null)) as (UploadReceipt & { error?: string }) | null;
  if (res.ok && data?.fileId) return { fileId: data.fileId, link: data.link, receipt: data.receipt };
  const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
  throw new SubmitError(data?.error ?? `Gagal mengunggah ${task.label}.`, retryable);
}

async function uploadWithRetry(task: UploadTask, submissionId: string, blob: Blob): Promise<UploadReceipt> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadOnce(task, submissionId, blob);
    } catch (err) {
      const retryable = err instanceof SubmitError && err.retryable;
      if (!retryable || attempt >= UPLOAD_RETRIES.length) throw err;
      await sleep(UPLOAD_RETRIES[attempt]!);
    }
  }
}

export function buildTasks(d: Draft): UploadTask[] {
  if (!d.pao || !d.pac) throw new SubmitError("Selfie awal dan foto penutup wajib diambil.", false);
  const tasks: UploadTask[] = [{ photo: d.pao, kind: "PAO", index: 1, label: "selfie awal" }];
  d.materials.forEach((m, i) => {
    if (!m.photo) throw new SubmitError(`Material #${i + 1} belum punya foto.`, false);
    tasks.push({ photo: m.photo, kind: "MATERIAL", index: i + 1, material: m.material, label: `foto material #${i + 1}` });
  });
  tasks.push({ photo: d.pac, kind: "PAC", index: 1, label: "foto penutup" });
  return tasks;
}

export async function runSubmission(draft: Draft, deps: SubmitDeps): Promise<SubmitResult> {
  if (draft.materials.length === 0) throw new SubmitError("Minimal 1 material per laporan.", false);
  const tasks = buildTasks(draft);
  const receipts: Record<string, UploadReceipt> = { ...draft.uploads };
  const total = tasks.length;
  let uploaded = tasks.filter((t) => receipts[t.photo.id]).length;
  deps.onProgress({ phase: "upload", uploaded, total, label: "Mengunggah foto…" });

  const queue = tasks.filter((t) => !receipts[t.photo.id]);
  let failure: unknown = null;

  async function worker() {
    while (queue.length > 0 && !failure) {
      const task = queue.shift()!;
      try {
        const blob = await deps.getPhotoBlob(task.photo.id);
        if (!blob) throw new SubmitError(`File ${task.label} tidak ditemukan di perangkat. Ambil ulang foto tersebut.`, false);
        deps.onProgress({ phase: "upload", uploaded, total, label: `Mengunggah ${task.label}…` });
        const receipt = await uploadWithRetry(task, draft.submissionId, blob);
        receipts[task.photo.id] = receipt;
        deps.saveReceipt(task.photo.id, receipt);
        uploaded++;
        deps.onProgress({ phase: "upload", uploaded, total, label: `Terunggah ${uploaded} dari ${total} foto` });
      } catch (err) {
        failure = failure ?? err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  if (failure) throw failure;

  // Semua foto sudah terunggah → simpan laporan.
  deps.onProgress({ phase: "finalize", uploaded, total, label: "Membuat PDF dan menyimpan ke spreadsheet…" });
  const photo = (p: PhotoRef): SubmitPhoto => ({ photoId: p.id, capture: p.capture, upload: receipts[p.id]! });
  const payload: SubmitPayload = {
    submissionId: draft.submissionId,
    gudang: draft.gudang,
    pao: photo(draft.pao!),
    pac: photo(draft.pac!),
    materials: draft.materials.map((m) => {
      const q = parseQuantity(m.quantity);
      if (q === null) throw new SubmitError(`Quantity material ${m.material} tidak valid.`, false);
      return { material: m.material, remark: m.remark, quantity: q, unit: m.unit.trim(), notes: m.notes.trim(), photo: photo(m.photo!) };
    }),
  };

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new SubmitError("Koneksi terputus saat menyimpan laporan. Semua foto sudah aman; tekan Coba Lagi.", true);
    }
    if (res.status === 401) throw new UnauthorizedError();
    const data = (await res.json().catch(() => null)) as (SubmitResult & { error?: string }) | null;
    if (res.ok && data?.submissionId) {
      deps.onProgress({ phase: "done", uploaded, total, label: "Laporan tersimpan" });
      return data;
    }
    const retryable = res.status >= 500 || res.status === 429;
    if (retryable && attempt < 2) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new SubmitError(data?.error ?? "Gagal menyimpan laporan.", retryable);
  }
}
