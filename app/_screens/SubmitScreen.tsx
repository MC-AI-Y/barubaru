"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useFlow } from "./flow";
import { UnauthorizedError } from "./report/capture-client";
import { useReport } from "./report/ReportProvider";
import { useReportErrors } from "./report/shared";
import { runSubmission, type SubmitProgress } from "./report/submit-client";
import styles from "./screens.module.css";

/** Proses kirim: unggah foto (progress, ulang otomatis) → simpan laporan (PDF + spreadsheet). */
export function SubmitScreen() {
  const { go } = useFlow();
  const { draft, update, getPhotoBlob, completeSubmission } = useReport();
  const handleError = useReportErrors();
  const [progress, setProgress] = useState<SubmitProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    if (!draft || running) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runSubmission(draft, {
        getPhotoBlob,
        saveReceipt: (photoId, receipt) => update((d) => ({ ...d, uploads: { ...d.uploads, [photoId]: receipt } })),
        onProgress: setProgress,
      });
      await completeSubmission({ ...result, subcontName: draft.subcontName });
      go("done");
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        handleError(err);
        return;
      }
      setError(err instanceof Error ? err.message : "Pengiriman gagal.");
      setProgress((p) => (p ? { ...p, label: "Pengiriman terhenti" } : p));
    } finally {
      setRunning(false);
    }
  }, [draft, running, getPhotoBlob, update, completeSubmission, go, handleError]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const total = progress?.total ?? (draft ? draft.materials.length + 2 : 0);
  const uploaded = progress?.uploaded ?? 0;
  const pct = progress?.phase === "done" ? 100 : progress?.phase === "finalize" ? 95 : total ? Math.round((uploaded / total) * 90) : 0;

  const tasks = [
    { label: `Mengunggah foto (${uploaded}/${total})`, state: !progress ? "todo" : progress.phase === "upload" ? "active" : "done" },
    { label: "Membuat formulir PDF", state: progress?.phase === "finalize" ? "active" : progress?.phase === "done" ? "done" : "todo" },
    { label: "Menyimpan ke spreadsheet", state: progress?.phase === "finalize" ? "active" : progress?.phase === "done" ? "done" : "todo" },
  ] as const;

  return (
    <ScreenShell
      eyebrow={error ? "Pengiriman terhenti" : "Jangan tutup halaman"}
      title={error ? "Pengiriman belum selesai" : "Mengirim laporan…"}
      description="Data disimpan ke spreadsheet setelah semua foto berhasil diunggah, sehingga laporan tidak pernah tersimpan setengah."
      actions={
        error ? (
          <>
            <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={() => go("review")} disabled={running}>
              Ke Review
            </Button>
            <Button icon={<Icon name="send" />} onClick={() => void start()} loading={running}>
              Coba Lagi
            </Button>
          </>
        ) : undefined
      }
    >
      <Card className={styles.progressCard}>
        <div className={styles.progressHead}>
          <span>{progress?.label ?? "Menyiapkan…"}</span>
          <span className={styles.progressPct}>{pct}%</span>
        </div>
        <div className={styles.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progres pengiriman laporan">
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <ul className={styles.taskList}>
          {tasks.map((t) => (
            <li key={t.label} className={`${styles.task} ${t.state === "done" ? styles.taskDone : ""} ${t.state === "active" && !error ? styles.taskActive : ""}`}>
              <span className={styles.taskIcon}>
                {t.state === "done" ? (
                  <Icon name="check" size={14} strokeWidth={3} />
                ) : t.state === "active" && !error ? (
                  <Spinner size={14} tone="currentColor" label={t.label} />
                ) : null}
              </span>
              {t.label}
            </li>
          ))}
        </ul>
      </Card>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
          <span style={{ fontWeight: 400 }}>
            Draf dan foto tetap aman di perangkat. Foto yang sudah terunggah tidak diunggah ulang. Tekan &quot;Coba Lagi&quot; saat sinyal membaik.
          </span>
        </div>
      ) : null}
    </ScreenShell>
  );
}
