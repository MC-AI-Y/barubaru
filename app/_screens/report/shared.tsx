"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeoFix } from "@/components/camera/useGeolocation";
import { useToast } from "@/components/ui/Toast";
import type { CaptureContext } from "@/lib/report/types";
import { useFlow } from "../flow";
import { requestCaptureContext, UnauthorizedError } from "./capture-client";
import { latestCapture } from "./draft";
import { useReport } from "./ReportProvider";
import styles from "./shared.module.css";

/** Gambar mini dari IndexedDB. */
export function PhotoThumb({ photoId, alt, kind = "thumb", className }: { photoId: string; alt: string; kind?: "thumb" | "full"; className?: string }) {
  const { photoUrl } = useReport();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void photoUrl(photoId, kind).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [photoId, kind, photoUrl]);
  return url ? (
    <img src={url} alt={alt} className={className ?? styles.thumb} decoding="async" />
  ) : (
    <span className={`${className ?? styles.thumb} ${styles.thumbEmpty}`} aria-label={alt} />
  );
}

/** Penanganan galat kamera/API yang seragam (401 → kembali ke Beranda). */
export function useReportErrors() {
  const toast = useToast();
  const { expireSession } = useFlow();
  return useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) {
        toast.show(err.message, "warning");
        expireSession();
        return;
      }
      toast.show(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.", "error");
    },
    [toast, expireSession],
  );
}

/** getContext untuk kamera: memakai cache lokasi dari foto sebelumnya di laporan ini. */
export function useCaptureContext() {
  const { draft } = useReport();
  return useCallback(
    (fix: GeoFix): Promise<CaptureContext> => requestCaptureContext(fix, draft ? latestCapture(draft) : null),
    [draft],
  );
}

/** Pesan bila data referensi gagal dimuat. */
export function ReferenceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.refError} role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className={styles.linkBtn}>
        Muat ulang
      </button>
    </div>
  );
}
