"use client";

import { useState } from "react";
import { CameraCapture, type CaptureResult } from "@/components/camera/CameraCapture";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format/time";
import { useFlow } from "./flow";
import { PhotoThumb, useCaptureContext, useReportErrors } from "./report/shared";
import { useReport } from "./report/ReportProvider";
import styles from "./screens.module.css";

/**
 * Photo Authorized Open (PAO): selfie kamera depan.
 * Photo Authorized Closed (PAC): kamera belakang.
 * Keduanya tanpa watermark.
 */
export function SelfieScreen({ kind }: { kind: "pao" | "pac" }) {
  const { go, back } = useFlow();
  const { draft, update, savePhoto, deletePhotos } = useReport();
  const [cameraOpen, setCameraOpen] = useState(false);
  const getContext = useCaptureContext();
  const handleError = useReportErrors();
  const isPao = kind === "pao";
  const photo = draft?.[kind] ?? null;

  async function handleUse(result: CaptureResult) {
    const ref = await savePhoto({
      full: result.full,
      thumb: result.thumb,
      ref: { capture: result.capture, width: result.width, height: result.height },
    });
    const old = draft?.[kind]?.id;
    update((d) => ({ ...d, [kind]: ref }));
    deletePhotos([old]);
    setCameraOpen(false);
  }

  const next = () => go(isPao ? "gudang" : "submit");

  return (
    <>
      <ScreenShell
        eyebrow={isPao ? "Photo Authorized Open" : "Photo Authorized Closed"}
        title={isPao ? "Selfie Awal" : "Foto Penutup"}
        description={
          isPao
            ? "Ambil selfie dengan kamera depan sebelum mengisi laporan. Waktu dan lokasi dicatat otomatis oleh server."
            : "Ambil foto penutup dengan kamera belakang sebelum laporan dikirim. Waktu dan lokasi dicatat otomatis oleh server."
        }
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={back}>
              Kembali
            </Button>
            {photo ? (
              <Button icon={<Icon name={isPao ? "arrowRight" : "send"} />} onClick={next}>
                {isPao ? "Lanjut" : "Kirim Laporan"}
              </Button>
            ) : (
              <Button icon={<Icon name="camera" />} onClick={() => setCameraOpen(true)}>
                {isPao ? "Ambil Selfie" : "Ambil Foto Penutup"}
              </Button>
            )}
          </>
        }
      >
        {photo ? (
          <Card className={styles.photoCard}>
            <PhotoThumb photoId={photo.id} kind="full" alt={isPao ? "Selfie awal" : "Foto penutup"} className={styles.photoLarge} />
            <div className={styles.meta}>
              <span className={styles.metaRow}>
                <Icon name="info" size={16} /> {formatDateTime(photo.capture.t, photo.capture.zone)}
              </span>
              <span className={styles.metaRow}>
                <Icon name="mapPin" size={16} /> {photo.capture.location}
              </span>
            </div>
            <Button variant="secondary" icon={<Icon name="camera" />} onClick={() => setCameraOpen(true)}>
              Ambil Ulang
            </Button>
          </Card>
        ) : (
          <div className={styles.emptyPhoto}>
            <span className={styles.emptyIcon}>
              <Icon name="camera" size={30} strokeWidth={1.8} />
            </span>
            <p>{isPao ? "Belum ada selfie." : "Belum ada foto penutup."}</p>
            <p>Izinkan akses Kamera dan Lokasi saat diminta browser. Foto diambil langsung dari kamera (tanpa galeri).</p>
          </div>
        )}
      </ScreenShell>

      {cameraOpen ? (
        <CameraCapture
          mode="selfie"
          facing={isPao ? "user" : "environment"}
          title={isPao ? "Selfie Awal (PAO)" : "Foto Penutup (PAC)"}
          getContext={getContext}
          onUse={handleUse}
          onClose={() => setCameraOpen(false)}
          onError={handleError}
        />
      ) : null}
    </>
  );
}

export const SelfiePaoScreen = () => <SelfieScreen kind="pao" />;
export const SelfiePacScreen = () => <SelfieScreen kind="pac" />;
