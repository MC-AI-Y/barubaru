"use client";

import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useFlow } from "./flow";
import { useReport } from "./report/ReportProvider";
import styles from "./screens.module.css";

export function DoneScreen() {
  const { go } = useFlow();
  const { lastResult, clearLastResult } = useReport();
  const pdfUrl = lastResult?.pdfFileId ? `/api/report/pdf?file=${encodeURIComponent(lastResult.pdfFileId)}` : null;

  function finish() {
    clearLastResult();
    go("visit");
  }

  return (
    <ScreenShell
      centered
      title="Laporan berhasil dikirim"
      description={
        lastResult?.duplicate
          ? "Laporan ini sudah tersimpan sebelumnya. Tidak ada data ganda."
          : `${lastResult?.rows ?? ""} material tersimpan. Formulir Material Stock sudah tersimpan di Drive. Unduh PDF bila diperlukan, lalu tekan Selesai.`
      }
      leading={
        <span className={styles.doneBadge}>
          <Icon name="checkCircle" size={52} strokeWidth={1.8} />
        </span>
      }
      actions={
        <>
          {pdfUrl ? (
            <a href={pdfUrl} download className={styles.downloadLink}>
              <Icon name="download" size={20} />
              Unduh PDF
            </a>
          ) : null}
          <Button variant="success" icon={<Icon name="check" />} onClick={finish}>
            Selesai
          </Button>
          <Button
            variant="secondary"
            icon={<Icon name="home" />}
            onClick={() => {
              clearLastResult();
              go("home");
            }}
          >
            Ke Beranda
          </Button>
        </>
      }
    >
      {lastResult ? <p className={styles.hintText}>Submission ID: {lastResult.submissionId}</p> : null}
    </ScreenShell>
  );
}
