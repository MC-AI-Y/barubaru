"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "insecure";

export interface GeoFix {
  lat: number;
  lon: number;
  acc: number;
  at: number;
}

/**
 * GPS aktif selama layar kamera terbuka. Izin lokasi WAJIB (readme bagian 5).
 * `waitForFix` dipakai saat tombol potret ditekan agar koordinat selalu ada.
 */
export function useGeolocation(active: boolean) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [fix, setFix] = useState<GeoFix | null>(null);
  const fixRef = useRef<GeoFix | null>(null);
  const watchId = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setStatus("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus((s) => (s === "ready" ? s : "locating"));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const f = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? 0, at: Date.now() };
        fixRef.current = f;
        setFix(f);
        setStatus("ready");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (!fixRef.current) setStatus("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [active, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /** Koordinat terbaru (≤ 30 detik), atau tunggu hingga 15 detik. */
  const waitForFix = useCallback(async (): Promise<GeoFix> => {
    const recent = fixRef.current;
    if (recent && Date.now() - recent.at < 30_000) return recent;
    return new Promise<GeoFix>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const f = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? 0, at: Date.now() };
          fixRef.current = f;
          setFix(f);
          setStatus("ready");
          resolve(f);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setStatus("denied");
          reject(new Error(err.code === err.PERMISSION_DENIED ? "Izin lokasi ditolak." : "Lokasi belum didapat. Pastikan GPS aktif lalu coba lagi."));
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );
    });
  }, []);

  return { status, fix, waitForFix, retry };
}
