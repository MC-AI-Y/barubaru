"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zoneFromOffset } from "@/lib/format/time";
import type { CaptureContext } from "@/lib/report/types";
import { useGeolocation, type GeoFix } from "./useGeolocation";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { compressCanvas, grabFrame, makeThumbnail, releaseCanvas } from "./image";
import { drawWatermark } from "./watermark";
import styles from "./CameraCapture.module.css";

export interface CaptureResult {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  capture: CaptureContext;
}

export interface CameraCaptureProps {
  /**
   * selfie = foto authorized tanpa watermark; material = kamera belakang, landscape, berwatermark;
   * document = kamera belakang, bebas portrait/landscape, berwatermark (bukti DO/TO/BOQ).
   */
  mode: "selfie" | "material" | "document";
  /** Kamera yang dipakai. Bawaan: depan untuk selfie, belakang untuk material. */
  facing?: "user" | "environment";
  /** Tampilkan tombol balik kamera depan/belakang. */
  allowFlip?: boolean;
  title: string;
  /** Meminta konteks resmi (waktu server + lokasi) saat tombol potret ditekan. */
  getContext: (fix: GeoFix) => Promise<CaptureContext>;
  /** Baris watermark (mode material dan document). */
  watermark?: (ctx: CaptureContext) => string[];
  onUse: (result: CaptureResult) => Promise<void> | void;
  onClose: () => void;
  onError?: (err: unknown) => void;
}

type Phase = "starting" | "live" | "processing" | "preview" | "error";

/** Kemampuan kamera tambahan (belum ada di tipe DOM bawaan). */
interface ExtraCapabilities {
  torch?: boolean;
  focusMode?: string[];
  pointsOfInterest?: unknown;
}

function trackCapabilities(track: MediaStreamTrack | undefined): ExtraCapabilities {
  try {
    return (track?.getCapabilities?.() ?? {}) as ExtraCapabilities;
  } catch {
    return {};
  }
}

async function applyAdvanced(track: MediaStreamTrack | undefined, constraint: Record<string, unknown>): Promise<boolean> {
  if (!track || track.readyState !== "live") return false;
  try {
    await track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

/** Browser bawaan aplikasi (Instagram, Facebook, LINE, dll.) sering memblokir kamera. */
function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent);
}

function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera hanya bisa dipakai lewat HTTPS. Buka WHControl dari alamat https:// (mis. domain Vercel).";
  }
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin kamera ditolak. Ketuk ikon gembok/pengaturan di samping alamat situs, izinkan Kamera, lalu tekan Coba Lagi.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Kamera tidak ditemukan di perangkat ini.";
  if (name === "NotReadableError" || name === "AbortError") {
    return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera/video call, lalu tekan Coba Lagi.";
  }
  if (name === "NotSupportedError" || inAppBrowser()) {
    return "Browser ini tidak mendukung kamera. Buka WHControl di Chrome (Android) atau Safari (iPhone), bukan dari dalam aplikasi chat/media sosial.";
  }
  return "Kamera tidak dapat dibuka. Pastikan izin kamera aktif lalu coba lagi.";
}

/**
 * Kamera dalam halaman: getUserMedia + canvas. TIDAK memakai <input type="file">,
 * sehingga galeri tidak bisa dipakai (readme bagian 5).
 */
export function CameraCapture({ mode, facing: facingProp, allowFlip, title, getContext, watermark, onUse, onClose, onError }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const [preview, setPreview] = useState<{ url: string; result: CaptureResult } | null>(null);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusMark, setFocusMark] = useState<{ x: number; y: number; key: number } | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geo = useGeolocation(true);
  const isSelfie = mode === "selfie";
  const needsLandscape = mode === "material";
  const [facing, setFacing] = useState<"user" | "environment">(facingProp ?? (isSelfie ? "user" : "environment"));
  const front = facing === "user";

  // Buka kamera.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setPhase("starting");
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(cameraErrorMessage(new Error("unsupported")));
        setPhase("error");
        return;
      }
      const ideal = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, ...ideal } });
      } catch (err) {
        if (err instanceof DOMException && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } catch (err2) {
            if (!cancelled) {
              setError(cameraErrorMessage(err2));
              setPhase("error");
            }
            return;
          }
        } else {
          if (!cancelled) {
            setError(cameraErrorMessage(err));
            setPhase("error");
          }
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // Flash (torch) dan fokus: hanya bila didukung HP/browser (umumnya Chrome Android, kamera belakang).
      const track = stream.getVideoTracks()[0];
      const caps = trackCapabilities(track);
      setTorchOn(false);
      setTorchSupported(caps.torch === true);
      const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      setFocusSupported(modes.includes("continuous") || modes.includes("single-shot") || caps.pointsOfInterest !== undefined);
      if (modes.includes("continuous")) void applyAdvanced(track, { focusMode: "continuous" });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setPhase("live");
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, attempt]);

  // Deteksi orientasi (foto material wajib landscape).
  useEffect(() => {
    if (!needsLandscape) return;
    const check = () => {
      const v = videoRef.current;
      const streamPortrait = v && v.videoWidth && v.videoHeight ? v.videoHeight > v.videoWidth : false;
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const screenPortrait = touch && window.matchMedia("(orientation: portrait)").matches;
      setPortrait(Boolean(streamPortrait || screenPortrait));
    };
    check();
    const id = window.setInterval(check, 400);
    window.addEventListener("orientationchange", check);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("orientationchange", check);
      window.removeEventListener("resize", check);
    };
  }, [needsLandscape]);

  // Jam perangkat (hanya tampilan; waktu resmi dari server saat memotret).
  useEffect(() => {
    const zone = zoneFromOffset(-new Date().getTimezoneOffset()) ?? "";
    const tick = () =>
      setClock(`${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}${zone ? ` ${zone}` : ""}`);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    },
    [],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    const next = !torchOn;
    const ok = await applyAdvanced(track, { torch: next });
    if (ok) setTorchOn(next);
    else if (next) onError?.(new Error("Flash tidak bisa dinyalakan di perangkat ini."));
  }, [torchOn, onError]);

  /** Ketuk layar untuk fokus ke titik itu. */
  const focusAt = useCallback(
    (e: { clientX: number; clientY: number; currentTarget: HTMLDivElement }) => {
      if (phase !== "live" || !focusSupported) return;
      const video = videoRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!video || !track || !video.videoWidth || !video.videoHeight) return;
      // Video memakai object-fit: contain → hitung area gambar sebenarnya.
      const box = video.getBoundingClientRect();
      const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      const left = box.left + (box.width - w) / 2;
      const top = box.top + (box.height - h) / 2;
      let x = (e.clientX - left) / w;
      const y = (e.clientY - top) / h;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      if (front) x = 1 - x; // tampilan kamera depan dicerminkan
      const stage = e.currentTarget.getBoundingClientRect();
      setFocusMark({ x: e.clientX - stage.left, y: e.clientY - stage.top, key: Date.now() });
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => setFocusMark(null), 1200);
      const modes = trackCapabilities(track).focusMode ?? [];
      const mode = modes.includes("continuous") ? "continuous" : modes.includes("single-shot") ? "single-shot" : undefined;
      void applyAdvanced(track, { pointsOfInterest: [{ x, y }], ...(mode ? { focusMode: mode } : {}) }).then((ok) => {
        if (!ok && mode) void applyAdvanced(track, { focusMode: mode });
      });
    },
    [phase, focusSupported, front],
  );

  const shoot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || phase !== "live") return;
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = grabFrame(video); // frame dibekukan tepat saat tombol ditekan
      setPhase("processing");
      const fix = await geo.waitForFix();
      const ctx = await getContext(fix);
      if (!isSelfie && watermark) drawWatermark(canvas, watermark(ctx));
      const [full, thumb] = await Promise.all([compressCanvas(canvas), makeThumbnail(canvas)]);
      const result: CaptureResult = { full, thumb, width: canvas.width, height: canvas.height, capture: ctx };
      setPreview({ url: URL.createObjectURL(full), result });
      setPhase("preview");
    } catch (err) {
      setPhase("live");
      onError?.(err);
    } finally {
      releaseCanvas(canvas);
    }
  }, [phase, geo, getContext, isSelfie, watermark, onError]);

  const retake = () => {
    setPreview(null);
    setPhase("live");
  };

  const use = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await onUse(preview.result);
    } catch (err) {
      onError?.(err);
    } finally {
      setSaving(false);
    }
  };

  const geoBlocked = geo.status === "denied" || geo.status === "insecure" || geo.status === "unavailable";
  const shutterDisabled = phase !== "live" || geo.status !== "ready" || (needsLandscape && portrait);

  let geoLabel = "Mencari lokasi…";
  if (geo.status === "ready" && geo.fix) geoLabel = `Lokasi ±${Math.round(geo.fix.acc)} m`;
  if (geo.status === "denied") geoLabel = "Izin lokasi ditolak";
  if (geo.status === "unavailable") geoLabel = "Lokasi tidak tersedia";
  if (geo.status === "insecure") geoLabel = "Butuh HTTPS";

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Tutup kamera">
          <Icon name="close" size={22} />
        </button>
        <p className={styles.title}>{title}</p>
        {allowFlip && phase !== "error" && phase !== "preview" ? (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              setTorchOn(false);
              setFacing((f) => (f === "user" ? "environment" : "user"));
            }}
            aria-label={front ? "Pindah ke kamera belakang" : "Pindah ke kamera depan"}
          >
            <Icon name="refresh" size={22} />
          </button>
        ) : null}
        {torchSupported && phase !== "error" ? (
          <button
            type="button"
            className={`${styles.iconBtn} ${torchOn ? styles.iconBtnOn : ""}`}
            onClick={() => void toggleTorch()}
            aria-label={torchOn ? "Matikan flash" : "Nyalakan flash"}
            aria-pressed={torchOn}
          >
            <Icon name={torchOn ? "flash" : "flashOff"} size={22} />
          </button>
        ) : (
          <span className={styles.spacer} />
        )}
      </div>

      <div className={styles.stage} onPointerDown={focusAt}>
        <video
          ref={videoRef}
          className={`${styles.video} ${front ? styles.mirror : ""} ${phase === "preview" ? styles.hidden : ""}`}
          playsInline
          muted
          autoPlay
        />
        {preview ? <img src={preview.url} alt="Hasil foto" className={styles.previewImg} /> : null}
        {focusMark && phase === "live" ? (
          <span key={focusMark.key} className={styles.focusRing} style={{ left: focusMark.x, top: focusMark.y }} aria-hidden="true" />
        ) : null}

        {phase === "starting" ? (
          <div className={styles.center}>
            <Spinner size={32} tone="currentColor" label="Membuka kamera" />
            <p>Membuka kamera…</p>
          </div>
        ) : null}

        {phase === "processing" ? (
          <div className={`${styles.center} ${styles.dim}`}>
            <Spinner size={32} tone="currentColor" label="Memproses" />
            <p>Mengambil waktu resmi &amp; lokasi dari server…</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className={styles.center}>
            <div className={styles.card}>
              <Icon name="camera" size={28} />
              <p>{error}</p>
              <div className={styles.cardActions}>
                <Button variant="secondary" onClick={onClose}>
                  Tutup
                </Button>
                <Button onClick={() => setAttempt((n) => n + 1)}>Coba Lagi</Button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "live" && geoBlocked ? (
          <div className={`${styles.center} ${styles.dim}`}>
            <div className={styles.card}>
              <Icon name="mapPin" size={28} />
              <p>
                {geo.status === "insecure"
                  ? "Lokasi hanya bisa dipakai lewat HTTPS."
                  : geo.status === "denied"
                    ? "Izin lokasi wajib aktif untuk memotret. Ketuk ikon gembok/pengaturan di samping alamat situs, izinkan Lokasi, aktifkan GPS, lalu tekan Coba Lagi."
                    : "Lokasi belum bisa didapat. Aktifkan GPS/Lokasi di HP, lalu tekan Coba Lagi."}
              </p>
              <div className={styles.cardActions}>
                <Button onClick={geo.retry}>Coba Lagi</Button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "live" && needsLandscape && portrait && !geoBlocked ? (
          <div className={`${styles.center} ${styles.dim}`}>
            <div className={styles.rotate} aria-hidden="true">
              <Icon name="arrowRight" size={34} />
            </div>
            <p className={styles.rotateText}>Putar HP ke mode landscape</p>
            <p className={styles.rotateHint}>Foto material wajib landscape. Tombol potret aktif setelah HP diputar.</p>
          </div>
        ) : null}
      </div>

      <div className={styles.bottomBar}>
        {phase === "preview" ? (
          <div className={styles.previewActions}>
            <Button variant="secondary" onClick={retake} disabled={saving}>
              Ulangi
            </Button>
            <Button variant="success" icon={<Icon name="check" />} loading={saving} onClick={use}>
              Gunakan Foto
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.status}>
              <span className={`${styles.chip} ${geo.status === "ready" ? styles.chipOk : ""}`}>
                <Icon name="mapPin" size={14} /> {geoLabel}
              </span>
              <span className={styles.chip} title="Jam perangkat (waktu resmi dicatat server saat memotret)">
                {clock}
              </span>
            </div>
            <button
              type="button"
              className={styles.shutter}
              onClick={shoot}
              disabled={shutterDisabled}
              aria-label={isSelfie ? (front ? "Ambil selfie" : "Ambil foto penutup") : mode === "document" ? "Ambil foto bukti" : "Ambil foto material"}
            >
              <span />
            </button>
            <p className={styles.helper}>
              {isSelfie
                ? front
                  ? "Kamera depan · tanpa galeri"
                  : "Kamera belakang · tanpa galeri"
                : mode === "document"
                  ? "Kamera belakang · watermark otomatis"
                  : "Kamera belakang · landscape · watermark otomatis"}
              {focusSupported ? " · ketuk layar untuk fokus" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
