"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nameKey } from "@/lib/format/text";
import type { MaterialOption } from "@/lib/google/parse";
import type { SubmitResult } from "@/lib/report/types";
import { apiRequest } from "../api";
import { useFlow } from "../flow";
import { newDraft, photoIds, type Draft, type PhotoRef } from "./draft";
import { draftStore, photoStore, requestPersistentStorage } from "./idb";
import { draftHasContent, draftStatusApi } from "./draft-sync";

/** Jeda minimal antar laporan ringkasan draf ke server. */
const STATUS_THROTTLE_MS = 20_000;
/** Kirim ulang ringkasan walau tidak berubah (penanda "masih aktif"). */
const STATUS_HEARTBEAT_MS = 30 * 60_000;

export interface CityOption {
  value: string;
  label: string;
}

type RefState =
  | { status: "idle" | "loading" }
  | { status: "ready"; cities: CityOption[]; materials: MaterialOption[] }
  | { status: "error"; message: string };

export interface LastResult extends SubmitResult {
  subcontName: string;
}

interface ReportApi {
  loaded: boolean;
  draft: Draft | null;
  storageError: string | null;
  reference: RefState;
  loadReference: () => void;
  startNew: () => Promise<Draft>;
  discard: () => Promise<void>;
  update: (fn: (d: Draft) => Draft) => void;
  savePhoto: (args: { full: Blob; thumb: Blob; ref: Omit<PhotoRef, "id" | "bytes"> }) => Promise<PhotoRef>;
  deletePhotos: (ids: (string | undefined | null)[]) => void;
  photoUrl: (id: string, kind: "thumb" | "full") => Promise<string | null>;
  getPhotoBlob: (id: string) => Promise<Blob | null>;
  lastResult: LastResult | null;
  completeSubmission: (result: LastResult) => Promise<void>;
  clearLastResult: () => void;
  /** Simpan draf ke perangkat sekarang juga (mis. sebelum kembali ke Beranda). */
  flushDraft: () => void;
}

const ReportContext = createContext<ReportApi | null>(null);
const LAST_RESULT_KEY = "whc:lastResult";

export function ReportProvider({ children }: { children: ReactNode }) {
  const { session } = useFlow();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [reference, setReference] = useState<RefState>({ status: "idle" });
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const urlCache = useRef(new Map<string, string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const key = session ? nameKey(session.subcontName) : null;

  // Muat draf milik akun yang login.
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setDraft(null);
    draftRef.current = null;
    setReference({ status: "idle" });
    if (!key) {
      setLoaded(true);
      return;
    }
    requestPersistentStorage();
    draftStore
      .get<Draft>(key)
      .then((d) => {
        if (!active) return;
        const valid = d && d.v === 1 ? d : null;
        draftRef.current = valid;
        setDraft(valid);
      })
      .catch((err: unknown) => setStorageError(err instanceof Error ? err.message : "Penyimpanan draf tidak tersedia."))
      .finally(() => active && setLoaded(true));
    try {
      const raw = sessionStorage.getItem(LAST_RESULT_KEY);
      if (raw) setLastResult(JSON.parse(raw) as LastResult);
    } catch {
      // Abaikan.
    }
    return () => {
      active = false;
    };
  }, [key]);

  // Simpan draf. Perubahan penting (foto, daftar material, bukti unggah) langsung disimpan;
  // ketikan di form ditunda 250 ms agar tidak membebani perangkat.
  const persist = useCallback(
    (d: Draft, immediate: boolean) => {
      if (!key) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const write = () =>
        draftStore.put(key, d).catch(() => setStorageError("Draf gagal disimpan di perangkat. Memori mungkin penuh."));
      if (immediate) void write();
      else saveTimer.current = setTimeout(write, 250);
    },
    [key],
  );

  // Simpan segera saat halaman disembunyikan (mis. aplikasi ditutup).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && key && draftRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        void draftStore.put(key, draftRef.current);
      }
    };
    const flushNow = () => {
      if (key && draftRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        void draftStore.put(key, draftRef.current);
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushNow);
    };
  }, [key]);

  // Peringatan sebelum meninggalkan halaman bila ada draf yang belum dikirim.
  useEffect(() => {
    if (!draft) return;
    const hasContent = Boolean(draft.pao || draft.materials.length || draft.form.photo);
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft]);

  // Ringkasan draf ke server agar perangkat lain bisa diberi tahu (tanpa foto).
  const statusSent = useRef<{ sig: string; at: number } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !draftHasContent(draft)) return;
    const sig = `${draft.submissionId}|${draft.gudang.warehouseName.trim()}|${draft.materials.length}`;
    const last = statusSent.current;
    const now = Date.now();
    if (last && last.sig === sig && now - last.at < STATUS_HEARTBEAT_MS) return;
    if (statusTimer.current) clearTimeout(statusTimer.current);
    const wait = last ? Math.max(0, STATUS_THROTTLE_MS - (now - last.at)) : 1_500;
    statusTimer.current = setTimeout(() => {
      const d = draftRef.current;
      if (!draftHasContent(d)) return;
      const sentSig = `${d.submissionId}|${d.gudang.warehouseName.trim()}|${d.materials.length}`;
      statusSent.current = { sig: sentSig, at: Date.now() };
      void draftStatusApi.report(d).then((r) => {
        if (!r.ok && statusSent.current?.sig === sentSig) statusSent.current = { sig: "", at: Date.now() };
      });
    }, wait);
  }, [session, draft]);
  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  const update = useCallback(
    (fn: (d: Draft) => Draft) => {
      const current = draftRef.current;
      if (!current) return;
      const next = { ...fn(current), updatedAt: Date.now() };
      draftRef.current = next;
      setDraft(next);
      const important =
        next.materials !== current.materials ||
        next.pao !== current.pao ||
        next.pac !== current.pac ||
        next.form.photo !== current.form.photo ||
        next.uploads !== current.uploads ||
        next.editingId !== current.editingId ||
        next.step !== current.step;
      persist(next, important);
    },
    [persist],
  );

  const revokeAll = useCallback(() => {
    urlCache.current.forEach((u) => URL.revokeObjectURL(u));
    urlCache.current.clear();
  }, []);

  const startNew = useCallback(async () => {
    if (!session || !key) throw new Error("Silakan login terlebih dahulu.");
    const old = draftRef.current;
    if (old && draftHasContent(old)) void draftStatusApi.remove(old.submissionId);
    statusSent.current = null;
    if (old) await photoStore.remove(photoIds(old)).catch(() => undefined);
    revokeAll();
    const d = newDraft(session.subcontName);
    draftRef.current = d;
    setDraft(d);
    await draftStore.put(key, d).catch(() => setStorageError("Draf gagal disimpan di perangkat."));
    return d;
  }, [session, key, revokeAll]);

  const discard = useCallback(async () => {
    const old = draftRef.current;
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusSent.current = null;
    if (old && draftHasContent(old)) void draftStatusApi.remove(old.submissionId);
    if (old) await photoStore.remove(photoIds(old)).catch(() => undefined);
    if (key) await draftStore.remove(key).catch(() => undefined);
    revokeAll();
    draftRef.current = null;
    setDraft(null);
  }, [key, revokeAll]);

  const savePhoto = useCallback<ReportApi["savePhoto"]>(async ({ full, thumb, ref }) => {
    const id = crypto.randomUUID();
    await photoStore.put({ id, full, thumb });
    return { ...ref, id, bytes: full.size };
  }, []);

  const deletePhotos = useCallback((ids: (string | undefined | null)[]) => {
    const clean = ids.filter((x): x is string => Boolean(x));
    for (const id of clean) {
      for (const kind of ["thumb", "full"]) {
        const k = `${id}:${kind}`;
        const u = urlCache.current.get(k);
        if (u) URL.revokeObjectURL(u);
        urlCache.current.delete(k);
      }
    }
    void photoStore.remove(clean).catch(() => undefined);
  }, []);

  const photoUrl = useCallback(async (id: string, kind: "thumb" | "full") => {
    const k = `${id}:${kind}`;
    const hit = urlCache.current.get(k);
    if (hit) return hit;
    const p = await photoStore.get(id).catch(() => undefined);
    if (!p) return null;
    const url = URL.createObjectURL(kind === "thumb" ? p.thumb : p.full);
    urlCache.current.set(k, url);
    return url;
  }, []);

  const getPhotoBlob = useCallback(async (id: string) => (await photoStore.get(id).catch(() => undefined))?.full ?? null, []);

  const loadReference = useCallback(() => {
    setReference((r) => (r.status === "loading" || r.status === "ready" ? r : { status: "loading" }));
    Promise.all([
      apiRequest<{ cities: CityOption[] }>("/api/reference/regions"),
      apiRequest<{ materials: MaterialOption[] }>("/api/reference/materials"),
    ]).then(([c, m]) => {
      if (c.ok && m.ok) setReference({ status: "ready", cities: c.data.cities, materials: m.data.materials });
      else setReference({ status: "error", message: (!c.ok ? c.message : !m.ok ? m.message : "") || "Gagal memuat data." });
    });
  }, []);

  useEffect(() => {
    if (session && reference.status === "idle") loadReference();
  }, [session, reference.status, loadReference]);

  const completeSubmission = useCallback(
    async (result: LastResult) => {
      setLastResult(result);
      try {
        sessionStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
      } catch {
        // Abaikan.
      }
      await discard();
    },
    [discard],
  );

  const flushDraft = useCallback(() => {
    if (key && draftRef.current) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void draftStore.put(key, draftRef.current).catch(() => setStorageError("Draf gagal disimpan di perangkat. Memori mungkin penuh."));
    }
  }, [key]);

  const clearLastResult = useCallback(() => {
    setLastResult(null);
    try {
      sessionStorage.removeItem(LAST_RESULT_KEY);
    } catch {
      // Abaikan.
    }
  }, []);

  useEffect(() => revokeAll, [revokeAll]);

  const api = useMemo<ReportApi>(
    () => ({
      loaded,
      draft,
      storageError,
      reference,
      loadReference,
      startNew,
      discard,
      update,
      savePhoto,
      deletePhotos,
      photoUrl,
      getPhotoBlob,
      lastResult,
      completeSubmission,
      clearLastResult,
      flushDraft,
    }),
    [loaded, draft, storageError, reference, loadReference, startNew, discard, update, savePhoto, deletePhotos, photoUrl, getPhotoBlob, lastResult, completeSubmission, clearLastResult, flushDraft],
  );

  return <ReportContext.Provider value={api}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportApi {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport harus dipakai di dalam <ReportProvider>.");
  return ctx;
}
