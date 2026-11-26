"use client";

import { useEffect, useState } from "react";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { useReport } from "./report/ReportProvider";
import { draftStatusApi, type RemoteDraft } from "./report/draft-sync";
import { useFlow } from "./flow";
import { REPORT_STEPS } from "./steps";
import styles from "./HomeScreen.module.css";

export function stepLabel(step: string): string {
  const id = step === "submit" ? "pac" : step;
  return REPORT_STEPS.find((s) => s.id === id)?.label ?? "Selfie Awal";
}

const DATE_FMT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function formatWhen(ms: number): string {
  return ms > 0 ? DATE_FMT.format(new Date(ms)).replace(/\./g, ":") : "-";
}

/**
 * Halaman awal fitur Visit (alur laporan WHControl v4.7).
 * Isinya sama dengan kartu Beranda versi 4.7: pemberitahuan draf di perangkat lain,
 * ringkasan draf, Mulai Laporan / Lanjutkan Pengisian Form, dan Buang Draf.
 */
export function VisitHomeScreen() {
  const { session, go } = useFlow();
  const toast = useToast();
  const confirm = useConfirm();
  const report = useReport();
  const [starting, setStarting] = useState(false);
  const draft = report.draft;
  const hasDraftContent = Boolean(draft && (draft.pao || draft.materials.length || draft.form.photo || draft.gudang.warehouseName));
  const [remoteDrafts, setRemoteDrafts] = useState<RemoteDraft[]>([]);
  const localSid = draft?.submissionId ?? null;
  const isSubcont = session?.role === "subcont";

  useEffect(() => {
    if (!session || !isSubcont || !report.loaded) {
      setRemoteDrafts([]);
      return;
    }
    let active = true;
    void draftStatusApi.list(localSid).then((r) => {
      if (active && r.ok) setRemoteDrafts(r.data.drafts);
    });
    return () => {
      active = false;
    };
  }, [session, isSubcont, report.loaded, localSid]);

  async function dismissRemote(item: RemoteDraft) {
    const ok = await confirm({
      title: "Hapus pemberitahuan ini?",
      message:
        "Pilih ini bila laporan tersebut memang tidak akan dikirim (misalnya HP hilang atau datanya sudah dihapus). Data di perangkat itu tidak ikut terhapus.",
      confirmLabel: "Hapus pemberitahuan",
    });
    if (!ok) return;
    const res = await draftStatusApi.remove(item.submissionId);
    if (res.ok) setRemoteDrafts((list) => list.filter((d) => d.submissionId !== item.submissionId));
    else toast.show(res.message, "error");
  }

  async function startReport() {
    if (draft) {
      go(draft.step === "submit" ? "pac" : draft.step);
      return;
    }
    setStarting(true);
    try {
      await report.startNew();
      go("pao");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Gagal memulai laporan.", "error");
    } finally {
      setStarting(false);
    }
  }

  async function discardDraft() {
    const ok = await confirm({
      title: "Buang draf laporan?",
      message: "Semua foto dan data yang belum dikirim akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Buang draf",
      tone: "danger",
    });
    if (ok) await report.discard();
  }

  if (!isSubcont) {
    return (
      <ScreenShell
        eyebrow="Visit"
        title="Khusus akun subcont"
        description="Laporan Visit dibuat oleh subcont di gudangnya masing-masing. Akun admin tidak membuat laporan Visit."
        actions={
          <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={() => go("home")}>
            Kembali ke Beranda
          </Button>
        }
      />
    );
  }

  return (
    <ScreenShell
      eyebrow="Visit"
      title="Laporan Stok Gudang"
      description="Selfie awal, data gudang, foto tiap material, review, lalu foto penutup. Formulir Material Stock dibuat otomatis."
      actions={
        <>
          <Button block icon={<Icon name="camera" />} onClick={startReport} loading={starting || !report.loaded}>
            {hasDraftContent ? "Lanjutkan Pengisian Form" : "Mulai Laporan"}
          </Button>
          {hasDraftContent ? (
            <Button block variant="ghost" icon={<Icon name="close" />} onClick={discardDraft}>
              Buang Draf
            </Button>
          ) : null}
          <Button block variant="secondary" icon={<Icon name="arrowLeft" />} onClick={() => go("home")}>
            Kembali ke Beranda
          </Button>
        </>
      }
    >
      <div className={styles.actions}>
        {remoteDrafts.length ? (
          <div className={styles.remote} role="status">
            <p className={styles.remoteTitle}>
              <Icon name="info" size={18} />
              <span>
                {remoteDrafts.length === 1
                  ? "Ada laporan belum terkirim di perangkat lain"
                  : `Ada ${remoteDrafts.length} laporan belum terkirim di perangkat lain`}
              </span>
            </p>
            <ul className={styles.remoteList}>
              {remoteDrafts.map((d) => (
                <li key={d.submissionId} className={styles.remoteItem}>
                  <p className={styles.remoteName}>{d.warehouse || "Gudang belum diisi"}</p>
                  <p className={styles.remoteMeta}>
                    {d.materialCount} material · dibuat {formatWhen(d.createdAt)} · terakhir diubah {formatWhen(d.updatedAt)}
                  </p>
                  <p className={styles.remoteMeta}>Perangkat: {d.device}</p>
                  <button type="button" className={styles.remoteDismiss} onClick={() => dismissRemote(d)}>
                    Hapus pemberitahuan
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.remoteHint}>
              Foto laporan hanya tersimpan di perangkat tersebut. Buka WHControl di perangkat itu, lalu lanjutkan dan kirim
              laporannya.
            </p>
          </div>
        ) : null}
        {hasDraftContent && draft ? (
          <div className={styles.resume}>
            <p className={styles.resumeTitle}>Ada laporan yang belum dikirim</p>
            <p className={styles.resumeText}>
              {draft.materials.length} material tersimpan
              {draft.gudang.warehouseName ? ` · ${draft.gudang.warehouseName}` : ""}
            </p>
            <p className={styles.resumeText}>Terakhir di langkah: {stepLabel(draft.step)}</p>
          </div>
        ) : (
          <p className={styles.visitNote}>Belum ada draf. Tekan Mulai Laporan untuk membuat laporan baru.</p>
        )}
      </div>
    </ScreenShell>
  );
}
