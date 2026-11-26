"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { CameraCapture, type CaptureResult } from "@/components/camera/CameraCapture";
import type { CaptureContext } from "@/lib/report/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import type { OrderDetail, OrderKind, OrderListResponse, OrderSummary, OrderView } from "@/lib/orders/types";
import { approvedValue, BOQ_CHOICES, needsAdminDecision, STATUS_VALUES } from "@/lib/orders/status";
import { unitFor } from "@/lib/google/parse";
import { documentWatermarkLines } from "@/components/camera/watermark";
import { adminApi, ordersApi, verifyApi } from "./api";
import { requestCaptureContext, UnauthorizedError } from "./report/capture-client";
import { useFlow } from "./flow";
import styles from "./OrdersScreen.module.css";

const TITLES: Record<OrderKind, { eyebrow: string; title: string; subcont: string; admin: string; numberLabel: string }> = {
  do: {
    eyebrow: "DO",
    title: "Delivery Order",
    subcont: "Material yang dikirim ke gudang Anda. Periksa barangnya, lalu verifikasi per nomor DO.",
    admin: "Semua DO dari semua subcont. Pilih subcont untuk fokus ke satu subcont.",
    numberLabel: "DO NUMBER",
  },
  to: {
    eyebrow: "TO",
    title: "Transfer Order",
    subcont: "Material pindahan antar gudang. TO masuk diverifikasi oleh Anda; TO keluar tampil sebagai informasi.",
    admin: "Semua TO dari semua subcont. Pilih subcont untuk fokus ke satu subcont.",
    numberLabel: "TO NUMBER",
  },
  boq: {
    eyebrow: "BOQ",
    title: "Bill of Quantity",
    subcont: "Pemakaian material per site. Verifikasi per Site Name.",
    admin: "Semua BOQ dari semua subcont. Pilih subcont untuk fokus ke satu subcont.",
    numberLabel: "Site Name",
  },
};

/**
 * Tab memakai nilai status dari database (v5.3).
 * DO/TO: RECEIVED (menunggu admin) / APPROVED. BOQ tanpa tahap admin: Perlu verifikasi / Terverifikasi.
 */
function viewsFor(kind: OrderKind, isAdmin: boolean): { id: OrderView; label: string }[] {
  const v = STATUS_VALUES[kind];
  if (!needsAdminDecision(kind)) {
    return isAdmin
      ? [
          { id: "waiting", label: "Belum dikirim subcont" },
          { id: "verified", label: "Terverifikasi" },
          { id: "all", label: "Semua" },
        ]
      : [
          { id: "todo", label: "Perlu verifikasi" },
          { id: "verified", label: "Terverifikasi" },
          { id: "all", label: "Semua" },
        ];
  }
  const pending = v.pending ?? "Menunggu admin";
  const approved = approvedValue(kind);
  return isAdmin
    ? [
        { id: "todo", label: pending },
        { id: "waiting", label: "Belum dikirim subcont" },
        { id: "verified", label: approved },
        { id: "all", label: "Semua" },
      ]
    : [
        { id: "todo", label: "Perlu verifikasi" },
        { id: "waiting", label: pending },
        { id: "verified", label: approved },
        { id: "all", label: "Semua" },
      ];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

const TIME_FMT = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Angka jumlah tanpa pemisah ribuan (keputusan v4.6); desimal memakai koma. */
export function qtyText(n: number | null): string {
  if (n === null) return "-";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

/**
 * Chip status kartu & detail:
 * - merah "Perlu verifikasi" (subcont) / "Perlu persetujuan" (admin) untuk dokumen yang menunggu tindakan akun ini;
 * - oranye "Belum diverifikasi" untuk dokumen kosong yang bukan giliran akun ini (seperti versi awal);
 * - isi kolom Verified di database apa adanya (ON DELIVERY, RECEIVED, APPROVED, NEED CHECK, APD, …).
 */
function StatusChip({ s, isAdmin }: { s: OrderSummary; isAdmin: boolean }) {
  const cls =
    s.status === "verified" ? styles.chipOk : s.status === "pending" ? styles.chipPending : s.status === "rejected" ? styles.chipRejected : styles.chipOpen;
  return (
    <>
      {s.needsAction ? (
        <span className={`${styles.chip} ${styles.chipAction}`}>{isAdmin ? "Perlu persetujuan" : "Perlu verifikasi"}</span>
      ) : !s.statusLabel && s.status === "open" ? (
        <span className={`${styles.chip} ${styles.chipOpen}`}>Belum diverifikasi</span>
      ) : null}
      {s.partial && s.status !== "verified" ? <span className={`${styles.chip} ${styles.chipWarn}`}>Sebagian terverifikasi</span> : null}
      {s.statusLabel ? <span className={`${styles.chip} ${cls}`}>{s.statusLabel}</span> : null}
    </>
  );
}

/** Kotak satu foto verifikasi: pratinjau + tombol ambil / ambil ulang. */
function PhotoSlot({
  label,
  hint,
  value,
  button,
  disabled,
  onTake,
}: {
  label: string;
  hint: string;
  value: { url: string } | null;
  button: string;
  disabled: boolean;
  onTake: () => void;
}) {
  return (
    <div className={styles.photoSlot}>
      <p className={styles.photoLabel}>{label}</p>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photoThumb} src={value.url} alt={`${label} yang akan dikirim`} />
      ) : (
        <p className={styles.photoEmpty}>{hint}</p>
      )}
      <Button size="md" variant={value ? "secondary" : "primary"} icon={<Icon name="camera" />} onClick={onTake} disabled={disabled}>
        {value ? "Ambil Ulang" : button}
      </Button>
    </div>
  );
}

/** Riwayat memakai nilai database yang setara (RECEIVED/APPROVED/NEED CHECK; BOQ: pilihan subcont). */
function HistoryChip({ kind, status, reviewedBy }: { kind: OrderKind; status: string; reviewedBy?: string }) {
  const v = STATUS_VALUES[kind];
  const choice = /\(pilih (.+)\)$/.exec(reviewedBy ?? "")?.[1];
  const [label, cls] =
    status === "Verified"
      ? [choice ?? approvedValue(kind), styles.chipOk]
      : status === "Ditolak"
        ? [v.rejected ?? "Ditolak", styles.chipRejected]
        : [v.pending ?? "Menunggu admin", styles.chipPending];
  return <span className={`${styles.chip} ${cls}`}>{label}</span>;
}

function DirectionChip({ s }: { s: OrderSummary }) {
  if (!s.direction) return null;
  return s.direction === "in" ? (
    <span className={`${styles.chip} ${styles.chipIn}`}>Masuk</span>
  ) : (
    <span className={`${styles.chip} ${styles.chipOutDir}`}>Keluar · info</span>
  );
}

export function OrdersScreen({ kind }: { kind: OrderKind }) {
  const { session, go, expireSession } = useFlow();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = session?.role === "admin";
  const meta = TITLES[kind];
  const VIEWS = viewsFor(kind, isAdmin);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [view, setView] = useState<OrderView>(VIEWS[0]!.id);
  // Pindah DO ↔ BOQ: tab yang tidak ada di jenis ini kembali ke tab pertama.
  useEffect(() => {
    if (!VIEWS.some((v) => v.id === view)) setView(VIEWS[0]!.id);
  }, [VIEWS, view]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [subcont, setSubcont] = useState("");
  const [region, setRegion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [items, setItems] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderSummary | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Verifikasi oleh subcont (v5.2): nama + telepon PIC + 2 foto kamera berwatermark (evidence + PIC) → kirim.
  /** Kamera untuk foto yang mana: evidence (barang / surat jalan) atau pic (orang yang meminta verifikasi). */
  const [cameraFor, setCameraFor] = useState<"evidence" | "pic" | null>(null);
  const cameraOpen = cameraFor !== null;
  type Shot = { photo: Blob; capture: CaptureContext; url: string };
  const [shot, setShot] = useState<Shot | null>(null);
  const [shotPic, setShotPic] = useState<Shot | null>(null);
  /** Satu ID per pengiriman (dibuat saat form dibuka) agar kirim ulang setelah sinyal putus tidak ganda. */
  const verificationIdRef = useRef(newId());
  const [picName, setPicName] = useState("");
  const [picPhone, setPicPhone] = useState("");
  const [notes, setNotes] = useState("");
  /** BOQ (v5.3): isi kolom Verified yang dipilih subcont. */
  const [boqChoice, setBoqChoice] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Keputusan admin: foto wajib dibuka sebelum Setujui.
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoSeen, setPhotoSeen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);
  useEffect(() => () => {
    if (shotPic) URL.revokeObjectURL(shotPic.url);
  }, [shotPic]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (page: number, refresh = false) => {
      const id = ++reqId.current;
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const res = await ordersApi.list({ kind, view, q: debounced, subcont, region, page, refresh, from, to });
      if (id !== reqId.current) return;
      setLoading(false);
      setLoadingMore(false);
      if (!res.ok) {
        if (res.status === 401) {
          expireSession();
          return;
        }
        setError(res.message);
        return;
      }
      setData(res.data);
      setItems((prev) => (page === 1 ? res.data.items : [...prev, ...res.data.items]));
    },
    [kind, view, debounced, subcont, region, from, to, expireSession],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  /** Kunci dokumen yang panelnya sedang terbuka (untuk mengabaikan respons yang terlambat). */
  const openKeyRef = useRef<string | null>(null);

  async function openDetail(s: OrderSummary) {
    openKeyRef.current = s.key;
    setSelected(s);
    setDetail(null);
    setDetailError(null);
    resetShot();
    const res = await ordersApi.detail(kind, s.key);
    // Panel sudah ditutup / pindah dokumen saat data datang: jangan dibuka lagi.
    if (openKeyRef.current !== s.key) return;
    if (res.ok) {
      setDetail(res.data);
      setSelected(res.data.summary);
    } else if (res.status === 401) expireSession();
    else setDetailError(res.message);
  }

  function closeDetail() {
    openKeyRef.current = null;
    setSelected(null);
  }

  function resetShot() {
    setShot(null);
    setShotPic(null);
    verificationIdRef.current = newId();
    setNotes("");
    setBoqChoice("");
    setPicName("");
    setPicPhone("");
    setSendError(null);
    setPhotoOpen(false);
    setPhotoSeen(false);
    setRejecting(false);
    setReason("");
    setDecideError(null);
  }

  async function decide(decision: "approve" | "reject") {
    if (!selected) return;
    if (decision === "approve") {
      const ok = await confirm({
        title: `Setujui ${meta.eyebrow} ${selected.number}?`,
        message: `Kolom Verified di sheet ${meta.eyebrow} diisi "${approvedValue(kind)}" untuk ${selected.materialCount} baris material, dan SMDT ikut diperbarui.`,
        confirmLabel: "Setujui",
      });
      if (!ok) return;
    }
    setDeciding(decision);
    setDecideError(null);
    const res = await adminApi.decide({ kind, key: selected.key, verificationId: selected.latest?.id, decision, reason: reason.trim() });
    setDeciding(null);
    if (!res.ok) {
      if (res.status === 401) {
        expireSession();
        return;
      }
      setDecideError(res.message);
      toast.show(res.message, "error");
      return;
    }
    if (res.data.status === "verified") {
      toast.show(`${meta.eyebrow} ${selected.number}: ${approvedValue(kind)}.${res.data.smdt ? ` ${res.data.smdt.message}` : ""}`, res.data.smdt && !res.data.smdt.ok ? "warning" : "success");
    } else {
      toast.show(`${meta.eyebrow} ${selected.number}: ${STATUS_VALUES[kind].rejected ?? "Ditolak"}. Dikembalikan ke subcont.`, "info");
    }
    closeDetail();
    resetShot();
    void load(1, true);
  }

  function handleCaptured(result: CaptureResult) {
    const next = { photo: result.full, capture: result.capture, url: URL.createObjectURL(result.full) };
    if (cameraFor === "pic") setShotPic(next);
    else setShot(next);
    verificationIdRef.current = newId(); // foto berubah = pengiriman baru
    setSendError(null);
    setCameraFor(null);
  }

  /** Watermark format Visit untuk seluruh isi dokumen (revisi 26 Nov 2026). */
  function watermarkFor(ctx: CaptureContext): string[] {
    const lines = detail ? [...detail.transferLines.map((l) => ({ material: l.material, qty: l.qty })), ...detail.boqLines.map((l) => ({ material: l.material, qty: l.qty }))] : [];
    const base = documentWatermarkLines({
      capture: ctx,
      subcontName: session?.subcontName ?? "",
      warehouseName: selected ? (kind === "boq" ? selected.subcontCity : selected.destination) : "",
      items: lines.map((l) => ({ ...l, unit: unitFor(l.material) })),
    });
    // Foto PIC: tambahkan siapa yang meminta verifikasi setelah baris Warehouse Name.
    if (cameraFor === "pic" && picName.trim()) base.splice(4, 0, `PIC: ${picName.trim()}${picPhone.trim() ? ` (${picPhone.trim()})` : ""}`);
    return base;
  }

  const formReady =
    Boolean(shot && shotPic) && picName.trim().length >= 2 && picPhone.replace(/\D/g, "").length >= 8 && (kind !== "boq" || Boolean(boqChoice));

  async function sendVerification() {
    if (!selected || !shot || !shotPic) return;
    if (kind === "boq" && !boqChoice) {
      setSendError("Pilih status BOQ terlebih dahulu.");
      return;
    }
    // Batas body Vercel 4,5 MB untuk kedua foto sekaligus (normalnya ±1 MB per foto).
    if (shot.photo.size + shotPic.photo.size > 4.2 * 1024 * 1024) {
      setSendError("Ukuran kedua foto terlalu besar untuk dikirim. Ambil ulang salah satu foto di tempat yang lebih terang.");
      return;
    }
    setSending(true);
    setSendError(null);
    const res = await verifyApi.submit({
      kind,
      key: selected.key,
      verificationId: verificationIdRef.current,
      notes: notes.trim(),
      picName: picName.trim(),
      picPhone: picPhone.trim(),
      capture: shot.capture,
      photo: shot.photo,
      capturePic: shotPic.capture,
      photoPic: shotPic.photo,
      boqChoice: kind === "boq" ? boqChoice : undefined,
    });
    setSending(false);
    if (!res.ok) {
      if (res.status === 401) {
        expireSession();
        return;
      }
      setSendError(res.message);
      toast.show(res.message, "error");
      return;
    }
    const label = res.data.statusLabel ?? STATUS_VALUES[kind].pending ?? "";
    const smdt = res.data.smdt;
    toast.show(`${meta.eyebrow} ${selected.number} terkirim. Status: ${label}.${smdt ? ` ${smdt.message}` : ""}`, smdt && !smdt.ok ? "warning" : "success");
    const current = selected;
    resetShot();
    void load(1, true);
    void openDetail(current);
  }

  const kpi = data?.kpi;
  const hasMore = data ? items.length < data.total : false;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>{meta.eyebrow}</p>
            <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
              {meta.title}
            </h1>
            <p className={styles.description}>{isAdmin ? meta.admin : meta.subcont}</p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className={styles.iconBtn} onClick={() => go("home")}>
              <Icon name="arrowLeft" size={18} />
              <span>Beranda</span>
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => void load(1, true)} disabled={loading}>
              <Icon name="refresh" size={18} />
              <span>Muat ulang</span>
            </button>
          </div>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Total dokumen</span>
            <span className={styles.kpiValue}>{kpi ? kpi.documents : "–"}</span>
          </div>
          <div className={`${styles.kpi} ${styles.kpiWarn}`}>
            <span className={styles.kpiLabel}>{isAdmin ? (needsAdminDecision(kind) ? "Menunggu admin" : "Belum dikirim subcont") : "Perlu verifikasi"}</span>
            <span className={styles.kpiValue}>{kpi ? (isAdmin && !needsAdminDecision(kind) ? kpi.waiting : kpi.action) : "–"}</span>
          </div>
          <div className={`${styles.kpi} ${styles.kpiOk}`}>
            <span className={styles.kpiLabel}>Terverifikasi</span>
            <span className={styles.kpiValue}>{kpi ? kpi.verified : "–"}</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>{kind === "boq" ? "Total Subcont Qty" : "Total QTY"}</span>
            <span className={styles.kpiValue}>{kpi ? qtyText(kpi.totalQty) : "–"}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Saring status">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={`${styles.tab} ${view === v.id ? styles.tabOn : ""}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <label className={styles.search}>
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder={kind === "boq" ? "Cari site, kota, material…" : "Cari nomor, kota, material…"}
                aria-label="Cari dokumen"
                maxLength={100}
              />
            </label>
            {isAdmin && data?.subconts ? (
              <select
                className={styles.select}
                value={subcont}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSubcont(e.target.value)}
                aria-label="Pilih subcont"
              >
                <option value="">Semua subcont</option>
                {data.subconts.map((r) => (
                  <option key={r.subcont} value={r.subcont}>
                    {r.subcont} {r.action && STATUS_VALUES[kind].pending ? `(${r.action} ${STATUS_VALUES[kind].pending})` : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className={styles.select}
              value={region}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setRegion(e.target.value)}
              aria-label="Pilih region"
            >
              <option value="">Semua region</option>
              {(data?.regions ?? []).concat(region && !(data?.regions ?? []).includes(region) ? [region] : []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {isAdmin ? (
            <div className={styles.dates}>
              <label>
                Dikirim dari
                <input type="date" value={from} max={to || undefined} onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} />
              </label>
              <label>
                sampai
                <input type="date" value={to} min={from || undefined} onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
              </label>
              {from || to ? (
                <button type="button" className={styles.clearDates} onClick={() => { setFrom(""); setTo(""); }}>
                  Hapus tanggal
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {data?.verifyWarning ? (
          <p className={styles.warnBar} role="status">
            <Icon name="alert" size={16} />
            {data.verifyWarning}
          </p>
        ) : null}

        {loading ? (
          <div className={styles.state}>
            <Spinner size={24} label="Memuat" />
            <span>Memuat data {meta.eyebrow}…</span>
          </div>
        ) : error ? (
          <div className={`${styles.state} ${styles.stateError}`} role="alert">
            <Icon name="alert" size={22} />
            <span>{error}</span>
            <Button size="md" variant="secondary" onClick={() => void load(1, true)}>
              Coba lagi
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            <Icon name="checkCircle" size={26} />
            <span>
              {view === "todo"
                ? isAdmin
                  ? `Tidak ada ${meta.eyebrow} yang menunggu persetujuan.`
                  : `Tidak ada ${meta.eyebrow} yang perlu diverifikasi.`
                : view === "waiting"
                  ? "Tidak ada dokumen yang sedang menunggu."
                : debounced
                  ? "Tidak ada dokumen yang cocok dengan pencarian."
                  : "Belum ada dokumen."}
            </span>
          </div>
        ) : (
          <>
            <p className={styles.count}>
              {data?.total} dokumen{data ? ` · data diambil pukul ${TIME_FMT.format(new Date(data.updatedAt)).replace(".", ":")}` : ""}
            </p>
            <ul className={styles.list}>
              {items.map((s) => (
                <li key={s.key}>
                  <button type="button" className={styles.card} onClick={() => void openDetail(s)}>
                    <div className={styles.cardTop}>
                      <span className={styles.number}>{s.number}</span>
                      <span className={styles.chips}>
                        <DirectionChip s={s} />
                        <StatusChip s={s} isAdmin={isAdmin} />
                      </span>
                    </div>
                    {kind === "boq" ? (
                      <p className={styles.route}>
                        <Icon name="mapPin" size={14} />
                        <span>
                          {s.subcontCity || "-"}
                          {s.siteType ? ` · ${s.siteType}` : ""}
                        </span>
                      </p>
                    ) : (
                      <p className={styles.route}>
                        <span className={styles.routeFrom}>{s.origin || "-"}</span>
                        <Icon name="arrowRight" size={14} />
                        <span className={styles.routeTo}>{s.destination || "-"}</span>
                      </p>
                    )}
                    <p className={styles.meta}>
                      {s.materialCount} material · QTY {qtyText(s.totalQty)}
                      {kind === "boq" && s.boqStatus ? ` · ${s.boqStatus}` : ""}
                      {s.region ? ` · ${s.region}` : ""}
                    </p>
                    {isAdmin && kind !== "boq" ? <p className={styles.owner}>{s.subcontCity || s.subcont}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
            {hasMore ? (
              <div className={styles.more}>
                <Button variant="secondary" size="md" loading={loadingMore} onClick={() => void load((data?.page ?? 1) + 1)}>
                  Muat lebih banyak
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet
        open={selected !== null && !cameraOpen}
        title={selected ? `${meta.eyebrow} ${selected.number}` : ""}
        onClose={() => {
          if (sending || deciding) return;
          closeDetail();
          resetShot();
        }}
      >
        {selected ? (
          <>
            {selected.needsAction && !isAdmin && detail ? (
              <div className={`${styles.verifyBox} ${styles.verifyTop}`}>
                <p className={styles.verifyTitle}>
                  <Icon name="user" size={18} />
                  {selected.status === "rejected" ? "Kirim ulang verifikasi · PIC" : "Verifikasi dokumen ini · PIC"}
                </p>
                <p className={styles.verifyHint}>
                  Isi nama dan telepon PIC yang meminta verifikasi, lalu ambil <strong>Foto PIC</strong> dengan kamera depan. Setelah
                  itu periksa material di bawah dan ambil <strong>Foto Evidence</strong> di bagian paling bawah.
                </p>
                <div className={styles.picGrid}>
                  <label className={styles.notesLabel}>
                    Nama PIC
                    <input
                      className={styles.input}
                      value={picName}
                      maxLength={80}
                      autoComplete="name"
                      placeholder="Mis. Budi Santoso"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPicName(e.target.value)}
                      disabled={sending}
                    />
                  </label>
                  <label className={styles.notesLabel}>
                    Nomor telepon PIC
                    <input
                      className={styles.input}
                      value={picPhone}
                      maxLength={20}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Mis. 081234567890"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPicPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
                      disabled={sending}
                    />
                  </label>
                </div>
                <PhotoSlot
                  label="Photo Evidence PIC"
                  hint="Orang yang meminta verifikasi"
                  value={shotPic}
                  button="Ambil Foto PIC"
                  disabled={sending}
                  onTake={() => setCameraFor("pic")}
                />
              </div>
            ) : null}
            <DetailBody kind={kind} summary={selected} detail={detail} error={detailError} isAdmin={isAdmin} />
            {selected.needsAction && !isAdmin && detail ? (
              <div className={`${styles.verifyBox} ${styles.verifyBottom}`}>
                <p className={styles.verifyTitle}>
                  <Icon name="camera" size={18} />
                  Evidence {meta.eyebrow}
                </p>
                <p className={styles.verifyHint}>
                  Ambil foto surat jalan atau barang saat tiba dengan kamera belakang. Foto otomatis diberi watermark.
                  {kind === "boq" ? " Pilih juga status BOQ; status langsung tersimpan tanpa menunggu admin." : ""}
                </p>
                <PhotoSlot
                  label="Photo Evidence"
                  hint="Surat jalan / barang saat tiba"
                  value={shot}
                  button="Ambil Foto Evidence"
                  disabled={sending}
                  onTake={() => setCameraFor("evidence")}
                />
                {kind === "boq" ? (
                  <fieldset className={styles.choiceSet}>
                    <legend className={styles.photoLabel}>Status BOQ (kolom Verified)</legend>
                    <div className={styles.choiceGrid} role="radiogroup" aria-label="Status BOQ">
                      {BOQ_CHOICES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={boqChoice === c}
                          className={`${styles.choice} ${boqChoice === c ? styles.choiceOn : ""}`}
                          onClick={() => setBoqChoice(c)}
                          disabled={sending}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {shot && shotPic ? (
                  <label className={styles.notesLabel}>
                    Catatan (opsional)
                    <textarea
                      className={styles.notes}
                      value={notes}
                      maxLength={500}
                      rows={2}
                      placeholder="Misalnya: 1 roll kabel kemasannya sobek"
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                      disabled={sending}
                    />
                  </label>
                ) : null}
                {sendError ? (
                  <p className={styles.sendError} role="alert">
                    {sendError}
                  </p>
                ) : null}
                <Button
                  block
                  icon={<Icon name="send" />}
                  loading={sending}
                  disabled={!formReady}
                  onClick={() => void sendVerification()}
                >
                  Kirim Verifikasi
                </Button>
                {!formReady ? (
                  <p className={styles.verifyHint}>
                    Lengkapi nama PIC, telepon PIC, foto evidence, foto PIC{kind === "boq" ? ", dan status BOQ" : ""} untuk mengaktifkan Kirim Verifikasi.
                  </p>
                ) : null}
              </div>
            ) : null}
            {isAdmin && selected.status === "pending" && detail ? (
              <div className={`${styles.verifyBox} ${styles.verifyBottom}`}>
                <p className={styles.verifyTitle}>
                  <Icon name="check" size={18} />
                  Keputusan admin
                </p>
                {selected.latest || selected.picPhoto ? (
                  <>
                    <p className={styles.verifyHint}>
                      Buka foto evidence dan foto PIC dari subcont terlebih dahulu. Tombol <strong>Setujui</strong> aktif setelah foto dibuka.
                      {selected.picName ? ` PIC yang meminta verifikasi: ${selected.picName}.` : ""}
                    </p>
                    <Button
                      variant={photoSeen ? "secondary" : "primary"}
                      size="md"
                      icon={<Icon name="camera" />}
                      onClick={() => {
                        if (selected.latest) setPhotoOpen(true);
                        else window.open(selected.picPhoto, "_blank", "noopener,noreferrer");
                        setPhotoSeen(true);
                      }}
                    >
                      {photoSeen ? "Lihat foto lagi" : selected.latest?.hasPicPhoto ? "Lihat 2 Foto Bukti" : "Lihat Foto Bukti"}
                    </Button>
                  </>
                ) : (
                  <p className={styles.verifyHint}>
                    Status {selected.statusLabel} diisi langsung di sheet (tanpa foto dari aplikasi). Anda tetap bisa memutuskan.
                  </p>
                )}
                {rejecting ? (
                  <label className={styles.notesLabel}>
                    Alasan penolakan (wajib)
                    <textarea
                      className={styles.notes}
                      value={reason}
                      maxLength={300}
                      rows={3}
                      placeholder="Misalnya: foto buram, jumlah roll tidak terlihat"
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                      disabled={deciding !== null}
                    />
                  </label>
                ) : null}
                {decideError ? (
                  <p className={styles.sendError} role="alert">
                    {decideError}
                  </p>
                ) : null}
                <div className={styles.verifyActions}>
                  {rejecting ? (
                    <>
                      <Button variant="secondary" size="md" onClick={() => setRejecting(false)} disabled={deciding !== null}>
                        Batal
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        icon={<Icon name="close" />}
                        loading={deciding === "reject"}
                        disabled={reason.trim().length < 3 || deciding !== null}
                        onClick={() => void decide("reject")}
                      >
                        Tolak
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" size="md" icon={<Icon name="close" />} onClick={() => setRejecting(true)} disabled={deciding !== null}>
                        Tolak…
                      </Button>
                      <Button
                        variant="success"
                        size="md"
                        icon={<Icon name="check" />}
                        loading={deciding === "approve"}
                        disabled={(!photoSeen && Boolean(selected.latest || selected.picPhoto)) || deciding !== null}
                        onClick={() => void decide("approve")}
                      >
                        Setujui
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      {photoOpen && selected?.latest ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Foto bukti verifikasi" onClick={() => setPhotoOpen(false)}>
          <div className={styles.lightboxPair} onClick={(e: ReactMouseEvent) => e.stopPropagation()}>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={verifyApi.photoUrl(kind, selected.latest.id)} alt={`Photo Evidence ${meta.eyebrow} ${selected.number}`} />
              <figcaption>Photo Evidence</figcaption>
            </figure>
            {selected.latest.hasPicPhoto ? (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={verifyApi.photoUrl(kind, selected.latest.id, "pic")} alt={`Photo Evidence PIC ${meta.eyebrow} ${selected.number}`} />
                <figcaption>Photo Evidence PIC</figcaption>
              </figure>
            ) : null}
          </div>
          <button type="button" className={styles.lightboxClose} onClick={() => setPhotoOpen(false)} aria-label="Tutup foto">
            <Icon name="close" size={22} />
          </button>
          <p className={styles.lightboxCaption}>
            {selected.latest.submittedBy} · {selected.latest.submittedText}
          </p>
        </div>
      ) : null}

      {cameraOpen && selected ? (
        <CameraCapture
          key={cameraFor}
          mode="document"
          facing={cameraFor === "pic" ? "user" : "environment"}
          allowFlip={cameraFor === "pic"}
          title={`${cameraFor === "pic" ? "Foto PIC" : "Foto Evidence"} ${meta.eyebrow} ${selected.number}`}
          watermark={watermarkFor}
          getContext={(fix) => requestCaptureContext(fix, null)}
          onUse={handleCaptured}
          onClose={() => setCameraFor(null)}
          onError={(err) => {
            if (err instanceof UnauthorizedError) expireSession();
          }}
        />
      ) : null}
    </div>
  );
}

function DetailBody({
  kind,
  summary,
  detail,
  error,
  isAdmin,
}: {
  kind: OrderKind;
  summary: OrderSummary;
  detail: OrderDetail | null;
  error: string | null;
  isAdmin: boolean;
}) {
  const s = detail?.summary ?? summary;
  const facts: [string, string][] =
    kind === "boq"
      ? [
          ["Site Name", s.siteName || "-"],
          ["Subcont City", s.subcontCity || "-"],
          ["Region", s.region || "-"],
          ["Site Type", s.siteType || "-"],
          ["Status", s.boqStatus || "-"],
          ["Verified", s.statusLabel || "-"],
          ["PIC Name", s.picName || "-"],
        ]
      : [
          ["Asal", s.origin || "-"],
          ["Tujuan", s.destination || "-"],
          ["Region", s.region || "-"],
          ["Verified", s.statusLabel || "-"],
          ["PIC Name", s.picName || "-"],
        ];

  return (
    <div className={styles.detail}>
      <div className={styles.detailChips}>
        <DirectionChip s={s} />
        <StatusChip s={s} isAdmin={isAdmin} />
      </div>
      <dl className={styles.facts}>
        {facts.map(([k, v]) => (
          <div key={k} className={styles.fact}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {(
          [
            ["Photo Evidence", s.evidence],
            ["Photo Evidence PIC", s.picPhoto],
          ] as const
        )
          .filter(([, url]) => /^https:\/\//.test(url))
          .map(([k, url]) => (
            <div key={k} className={styles.fact}>
              <dt>{k}</dt>
              <dd>
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.factLink}>
                  Buka di Drive
                </a>
              </dd>
            </div>
          ))}
      </dl>

      {error ? (
        <p className={styles.stateError} role="alert">
          {error}
        </p>
      ) : !detail ? (
        <div className={styles.state}>
          <Spinner size={20} label="Memuat" />
          <span>Memuat material…</span>
        </div>
      ) : kind === "boq" ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Material</th>
                <th className={styles.num}>QTY</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {detail.boqLines.map((l) => (
                <tr key={l.row}>
                  <td>{l.material}</td>
                  <td className={styles.num}>
                    {l.qty === null ? l.qtyText || "-" : qtyText(l.qty)} {unitFor(l.material)}
                  </td>
                  <td>{l.statusValue ? <span className={styles.dbValue}>{l.statusValue}</span> : <span className={styles.dash}>-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Material</th>
                <th className={styles.num}>QTY</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {detail.transferLines.map((l) => (
                <tr key={l.row}>
                  <td>{l.material}</td>
                  <td className={styles.num}>
                    {l.qty === null ? l.qtyText || "-" : qtyText(l.qty)} {unitFor(l.material)}
                  </td>
                  <td>{l.statusValue ? <span className={styles.dbValue}>{l.statusValue}</span> : <span className={styles.dash}>-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.status === "rejected" ? (
        <p className={styles.rejectNote} role="status">
          <Icon name="alert" size={16} />
          <span>
            <strong>{s.statusLabel}</strong>
            {s.latest?.status === "Ditolak" ? `${s.latest.reviewedText ? ` (${s.latest.reviewedText})` : ""}: ${s.latest.rejectReason || "tanpa alasan"}` : ""}.
            {s.canVerify ? " Periksa lagi lalu kirim ulang verifikasi." : ""}
          </span>
        </p>
      ) : s.status === "pending" ? (
        <p className={styles.soonNote}>
          <Icon name="info" size={16} />
          {s.latest ? `Dikirim ${s.latest.submittedText} oleh ${s.latest.submittedBy}. ` : ""}
          Status {s.statusLabel}: menunggu keputusan admin.
        </p>
      ) : s.direction === "out" ? (
        <p className={styles.soonNote}>
          <Icon name="info" size={16} />
          TO keluar diverifikasi oleh subcont tujuan.
        </p>
      ) : null}

      {detail && detail.history.length ? (
        <div className={styles.history}>
          <p className={styles.historyTitle}>Riwayat verifikasi</p>
          <ul className={styles.historyList}>
            {detail.history.map((h) => (
              <li key={h.id} className={styles.historyItem}>
                {h.hasPhoto || h.hasPicPhoto ? (
                  <div className={styles.historyThumbs}>
                    {h.hasPhoto ? (
                      <a href={verifyApi.photoUrl(kind, h.id)} target="_blank" rel="noopener noreferrer" className={styles.historyThumb} title="Photo Evidence">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={verifyApi.photoUrl(kind, h.id)} alt="Photo Evidence" loading="lazy" />
                      </a>
                    ) : null}
                    {h.hasPicPhoto ? (
                      <a href={verifyApi.photoUrl(kind, h.id, "pic")} target="_blank" rel="noopener noreferrer" className={styles.historyThumb} title="Photo Evidence PIC">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={verifyApi.photoUrl(kind, h.id, "pic")} alt="Photo Evidence PIC" loading="lazy" />
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.historyText}>
                  <HistoryChip kind={kind} status={h.status} reviewedBy={h.reviewedBy} />
                  <p className={styles.historyMeta}>
                    Dikirim {h.submittedText} · {h.submittedBy}
                  </p>
                  {h.picName ? (
                    <p className={styles.historyMeta}>
                      PIC: {h.picName}
                      {h.picPhone ? ` · ${h.picPhone}` : ""}
                    </p>
                  ) : null}
                  {h.location ? <p className={styles.historyMeta}>{h.location}</p> : null}
                  {h.notes ? <p className={styles.historyNote}>Catatan: {h.notes}</p> : null}
                  {h.reviewedText ? (
                    <p className={styles.historyMeta}>
                      Diputuskan {h.reviewedText}
                      {h.reviewedBy ? ` · ${h.reviewedBy}` : ""}
                    </p>
                  ) : null}
                  {h.rejectReason ? <p className={styles.historyReject}>Alasan: {h.rejectReason}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
