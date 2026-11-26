"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { useReport } from "./report/ReportProvider";
import { draftStatusApi } from "./report/draft-sync";
import { ordersApi } from "./api";
import type { OrderKind } from "@/lib/orders/types";
import { useFlow } from "./flow";
import { FEATURES, READY_FEATURES, type FeatureId } from "./steps";
import { stepLabel } from "./VisitHomeScreen";
import styles from "./HubScreen.module.css";

/**
 * Beranda setelah login (Phase 2): sapaan, kotak "Perlu tindakan", dan menu 5 fitur
 * (Dashboard, DO, TO, BOQ, Visit). Admin melihat menu yang sama; Visit khusus subcont.
 */
export function HubScreen() {
  const { session, go, signOut } = useFlow();
  const toast = useToast();
  const confirm = useConfirm();
  const report = useReport();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const [orderCounts, setOrderCounts] = useState<Record<OrderKind, number | null> | null>(null);
  const [orderErrors, setOrderErrors] = useState<Partial<Record<OrderKind, string>>>({});
  const [countsFailed, setCountsFailed] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const isAdmin = session?.role === "admin";
  const draft = report.draft;
  const hasDraftContent = Boolean(draft && (draft.pao || draft.materials.length || draft.form.photo || draft.gudang.warehouseName));
  const localSid = draft?.submissionId ?? null;

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!session || isAdmin || !report.loaded) {
      setRemoteCount(0);
      return;
    }
    let active = true;
    void draftStatusApi.list(localSid).then((r) => {
      if (active && r.ok) setRemoteCount(r.data.drafts.length);
    });
    return () => {
      active = false;
    };
  }, [session, isAdmin, report.loaded, localSid, refreshTick]);

  // Muat ulang notifikasi saat aplikasi kembali dibuka (pindah tab / buka HP lagi).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") setRefreshTick((t) => t + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Jumlah DO/TO/BOQ yang perlu diverifikasi akun ini.
  useEffect(() => {
    if (!session) return;
    let active = true;
    void ordersApi.counts().then((r) => {
      if (!active) return;
      if (r.ok) {
        setOrderCounts(r.data.counts);
        setOrderErrors(r.data.errors ?? {});
        setCountsFailed(null);
      } else {
        setCountsFailed(r.message);
      }
    });
    return () => {
      active = false;
    };
  }, [session, refreshTick]);

  if (!session) return null;

  async function handleSignOut() {
    if (hasDraftContent) {
      const ok = await confirm({
        title: "Keluar sekarang?",
        message: "Draf laporan tetap tersimpan di perangkat ini dan bisa dilanjutkan setelah login lagi dengan akun yang sama.",
        confirmLabel: "Keluar",
      });
      if (!ok) return;
    }
    setLeaving(true);
    const error = await signOut();
    setLeaving(false);
    if (error) toast.show(error, "error");
  }

  function badgeFor(id: FeatureId): string | null {
    if (id === "do" || id === "to" || id === "boq") {
      const n = orderCounts?.[id] ?? 0;
      return n > 0 ? (n > 99 ? "99+" : String(n)) : null;
    }
    if (id !== "visit" || isAdmin) return null;
    const n = (hasDraftContent ? 1 : 0) + remoteCount;
    return n > 0 ? String(n) : null;
  }

  const todo: { key: string; text: string; detail?: string; action: () => void; label: string; warn?: boolean }[] = [];
  if (!isAdmin && hasDraftContent && draft) {
    todo.push({
      key: "draft",
      text: "Laporan Visit belum dikirim",
      detail: `${draft.materials.length} material · terakhir di langkah ${stepLabel(draft.step)}`,
      action: () => go(draft.step === "submit" ? "pac" : draft.step),
      label: "Lanjutkan Pengisian Form",
    });
  }
  const ORDER_TODO: { kind: OrderKind; label: string }[] = [
    { kind: "do", label: "DO" },
    { kind: "to", label: "TO" },
    { kind: "boq", label: "BOQ" },
  ];
  for (const { kind, label } of ORDER_TODO) {
    const n = orderCounts?.[kind] ?? 0;
    if (n > 0) {
      todo.push({
        key: kind,
        text: isAdmin ? `${n} ${label} menunggu persetujuan admin` : `${n} ${label} perlu diverifikasi`,
        detail: isAdmin ? "Sudah dikirim subcont dengan foto bukti" : undefined,
        action: () => go(kind),
        label: "Buka",
      });
    }
  }
  for (const { kind, label } of ORDER_TODO) {
    const message = orderErrors[kind];
    if (message) {
      todo.push({ key: `err-${kind}`, text: `${label} tidak bisa diperiksa`, detail: message, action: () => go(kind), label: "Buka", warn: true });
    }
  }
  if (countsFailed) {
    todo.push({
      key: "err-counts",
      text: "Dokumen DO, TO, dan BOQ belum bisa diperiksa",
      detail: countsFailed,
      action: () => setRefreshTick((t) => t + 1),
      label: "Coba lagi",
      warn: true,
    });
  }
  if (!isAdmin && remoteCount > 0) {
    todo.push({
      key: "remote",
      text: remoteCount === 1 ? "1 laporan Visit belum terkirim di perangkat lain" : `${remoteCount} laporan Visit belum terkirim di perangkat lain`,
      action: () => go("visit"),
      label: "Lihat",
    });
  }

  return (
    <div className={styles.hub}>
      <div className={styles.inner}>
        <section className={styles.banner}>
          <p className={styles.bannerLabel}>{isAdmin ? "Admin YOFC" : "Subcont"}</p>
          <h1 ref={titleRef} tabIndex={-1} className={styles.bannerTitle}>
            Halo, {isAdmin ? "Admin" : session.subcontName}
          </h1>
          <p className={styles.bannerText}>
            {isAdmin
              ? "Pantau dan verifikasi dokumen DO, TO, dan BOQ dari semua subcont."
              : "Pilih fitur di bawah. Verifikasi dokumen dan laporan stok gudang Anda ada di sini."}
          </p>
        </section>

        <section className={styles.todo} aria-labelledby="todo-title">
          <h2 id="todo-title" className={styles.sectionTitle}>
            <Icon name="alert" size={18} />
            Perlu tindakan
          </h2>
          {todo.length ? (
            <ul className={styles.todoList}>
              {todo.map((t) => (
                <li key={t.key} className={`${styles.todoItem} ${t.warn ? styles.todoWarn : ""}`}>
                  <div className={styles.todoText}>
                    <p className={styles.todoMain}>{t.text}</p>
                    {t.detail ? <p className={styles.todoDetail}>{t.detail}</p> : null}
                  </div>
                  <button type="button" className={styles.todoBtn} onClick={t.action}>
                    {t.label}
                    <Icon name="arrowRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.todoEmpty}>
              {orderCounts || countsFailed ? "Tidak ada yang perlu ditindaklanjuti saat ini." : "Memeriksa dokumen DO, TO, dan BOQ…"}
            </p>
          )}
        </section>

        <section aria-labelledby="menu-title">
          <h2 id="menu-title" className={styles.sectionTitle}>
            <Icon name="layoutGrid" size={18} />
            Menu
          </h2>
          <div className={styles.grid}>
            {FEATURES.map((f) => {
              const ready = READY_FEATURES.includes(f.id);
              const adminBlocked = f.id === "visit" && isAdmin;
              const badge = badgeFor(f.id);
              const status = adminBlocked ? "Khusus subcont" : ready ? null : "Segera hadir";
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.tile} ${adminBlocked ? styles.tileMuted : ""}`}
                  onClick={() => go(f.id)}
                  aria-label={`${f.label}${status ? ` (${status})` : ""}${badge ? `, ${badge} perlu tindakan` : ""}`}
                >
                  <span className={`${styles.tileIcon} ${styles[`tone_${f.id}`]}`}>
                    <Icon name={f.icon} size={24} />
                  </span>
                  <span className={styles.tileLabel}>{f.short}</span>
                  <span className={styles.tileDesc}>{f.description}</span>
                  {status ? <span className={styles.tileStatus}>{status}</span> : null}
                  {badge ? <span className={styles.badge}>{badge}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <div className={styles.footer}>
          <Button variant="secondary" icon={<Icon name="logout" />} loading={leaving} onClick={handleSignOut}>
            Keluar
          </Button>
        </div>
      </div>
    </div>
  );
}
