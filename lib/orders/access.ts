/**
 * Siapa melihat dokumen apa, dan ringkasan daftar (spesifikasi v5.0 bagian 5.3–5.4, 6).
 * Murni (tanpa jaringan).
 *
 * - Admin melihat semua dokumen dan semua subcont.
 * - DO: subcont TUJUAN (WH/SUPPLIER DESTINATION) melihat dan memverifikasi.
 * - TO: subcont TUJUAN memverifikasi (masuk/Borrow); subcont ASAL ikut melihat sebagai informasi (keluar/Handover).
 * - BOQ: subcont pemilik (kolom Subcont).
 */
import { nameKey } from "../format/text";
import type { VerificationRecord } from "../verify/records";
import { documentState } from "./status";
import { boqKey, groupBy, transferKey } from "./parse";
import type {
  BoqLine,
  Direction,
  LatestVerification,
  OrderDetail,
  OrderStatus,
  OrderKind,
  OrderKpi,
  OrderSummary,
  OrderView,
  SubcontRecap,
  TransferLine,
} from "./types";

export interface Viewer {
  subcontName: string;
  role: "admin" | "subcont";
}

/**
 * Nama subcont cocok dengan akun (tanpa beda huruf/spasi).
 * Bila kolom subcont kosong, Subcont City dipakai: sama dengan nama akun atau diawali "nama akun + spasi".
 * Bila kolom subcont terisi, hanya nama persis yang cocok agar "CV DAYA" tidak melihat milik "CV DAYA ABADI".
 */
export function belongsTo(account: string, subcont: string, subcontCity: string): boolean {
  const a = nameKey(account);
  if (!a) return false;
  if (nameKey(subcont)) return nameKey(subcont) === a;
  const sc = nameKey(subcontCity);
  return sc === a || sc.startsWith(`${a} `);
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function first(values: readonly string[]): string {
  return values.find((v) => v) ?? "";
}

/**
 * Status dokumen HANYA dari kolom Verified di sheet asli (revisi 26 Nov 2026: tidak ada status lain
 * selain yang ada di database). Catatan di spreadsheet Verifikasi hanya untuk riwayat dan foto.
 */
export function statusOf(kind: OrderKind, values: readonly string[]): { status: OrderStatus; label: string; partial: boolean } {
  const d = documentState(kind, values);
  const status: OrderStatus = d.state === "approved" ? "verified" : d.state === "pending" ? "pending" : d.state === "rejected" ? "rejected" : "open";
  return { status, label: d.label, partial: d.partial };
}

function latestView(r: VerificationRecord | undefined): LatestVerification | null {
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    submittedAt: r.submittedAt,
    submittedText: r.submittedText,
    submittedBy: r.submittedBy,
    rejectReason: r.rejectReason,
    reviewedText: r.reviewedText,
    hasPicPhoto: Boolean(r.picPhotoFileId),
  };
}

function actionFor(viewer: Viewer, status: OrderStatus, canVerify: boolean): boolean {
  if (viewer.role === "admin") return status === "pending";
  return canVerify && (status === "open" || status === "rejected");
}

export type HistoryIndex = ReadonlyMap<string, readonly VerificationRecord[]>;

const EMPTY_HISTORY: HistoryIndex = new Map();

function historyView(list: readonly VerificationRecord[] | undefined) {
  return [...(list ?? [])].reverse().map((r) => ({
    id: r.id,
    status: r.status,
    submittedText: r.submittedText,
    submittedBy: r.submittedBy,
    picName: r.picName,
    picPhone: r.picPhone,
    location: r.location,
    hasPicPhoto: Boolean(r.picPhotoFileId),
    notes: r.notes,
    reviewedText: r.reviewedText,
    reviewedBy: r.reviewedBy,
    rejectReason: r.rejectReason,
    hasPhoto: Boolean(r.photoFileId),
  }));
}

/** Membentuk ringkasan dokumen DO/TO yang boleh dilihat viewer. */
export function transferSummaries(
  kind: "do" | "to",
  lines: readonly TransferLine[],
  viewer: Viewer,
  history: HistoryIndex = EMPTY_HISTORY,
): Map<string, OrderDetail> {
  const out = new Map<string, OrderDetail>();
  for (const [key, group] of groupBy(lines, transferKey)) {
    const head = group[0]!;
    const destSubcont = first(group.map((l) => l.destSubcont));
    const destSubcontCity = first(group.map((l) => l.destSubcontCity));
    const originSubcont = first(group.map((l) => l.originSubcont));
    const originSubcontCity = first(group.map((l) => l.originSubcontCity));

    let direction: Direction | null = null;
    let canVerify = false;
    if (viewer.role === "admin") {
      canVerify = true;
    } else if (belongsTo(viewer.subcontName, destSubcont, destSubcontCity)) {
      direction = kind === "to" ? "in" : null;
      canVerify = true;
    } else if (kind === "to" && belongsTo(viewer.subcontName, originSubcont, originSubcontCity)) {
      direction = "out";
    } else {
      continue;
    }

    const records = history.get(key);
    const latest = records?.[records.length - 1];
    const { status, label, partial } = statusOf(kind, group.map((l) => l.statusValue));
    out.set(key, {
      summary: {
        kind,
        key,
        number: head.docNumber,
        subcont: destSubcont,
        subcontCity: destSubcontCity,
        region: first(group.map((l) => l.region)),
        origin: originSubcontCity || [originSubcont, first(group.map((l) => l.originCity))].filter(Boolean).join(" "),
        destination: destSubcontCity || [destSubcont, first(group.map((l) => l.destCity))].filter(Boolean).join(" "),
        siteName: "",
        siteType: "",
        boqStatus: "",
        materialCount: group.length,
        totalQty: sum(group.map((l) => l.qty)),
        status,
        statusLabel: label,
        picName: first(group.map((l) => l.picName)),
        picPhoto: first(group.map((l) => l.picPhoto)),
        evidence: first(group.map((l) => l.evidence)),
        partial,
        direction,
        canVerify,
        needsAction: actionFor(viewer, status, canVerify),
        latest: latestView(latest),
        lastRow: Math.max(...group.map((l) => l.row)),
      },
      transferLines: group,
      boqLines: [],
      history: historyView(records),
    });
  }
  return out;
}

/** Membentuk ringkasan dokumen BOQ yang boleh dilihat viewer. */
export function boqSummaries(lines: readonly BoqLine[], viewer: Viewer, history: HistoryIndex = EMPTY_HISTORY): Map<string, OrderDetail> {
  const out = new Map<string, OrderDetail>();
  for (const [key, group] of groupBy(lines, boqKey)) {
    const head = group[0]!;
    const isAdmin = viewer.role === "admin";
    if (!isAdmin && !belongsTo(viewer.subcontName, head.subcont, head.subcontCity)) continue;
    const records = history.get(key);
    const latest = records?.[records.length - 1];
    const { status, label, partial } = statusOf("boq", group.map((l) => l.statusValue));
    out.set(key, {
      summary: {
        kind: "boq",
        key,
        number: head.siteName,
        subcont: head.subcont,
        subcontCity: head.subcontCity,
        region: first(group.map((l) => l.region)),
        origin: "",
        destination: "",
        siteName: head.siteName,
        siteType: first(group.map((l) => l.siteType)),
        boqStatus: first(group.map((l) => l.status)),
        materialCount: group.length,
        totalQty: sum(group.map((l) => l.qty)),
        status,
        statusLabel: label,
        picName: first(group.map((l) => l.picName)),
        picPhoto: first(group.map((l) => l.picPhoto)),
        evidence: first(group.map((l) => l.evidence)),
        partial,
        direction: null,
        canVerify: true,
        needsAction: actionFor(viewer, status, true),
        latest: latestView(latest),
        lastRow: Math.max(...group.map((l) => l.row)),
      },
      transferLines: [],
      boqLines: group,
      history: historyView(records),
    });
  }
  return out;
}

export function buildDocuments(
  kind: OrderKind,
  data: { transfer?: readonly TransferLine[]; boq?: readonly BoqLine[] },
  viewer: Viewer,
  history: HistoryIndex = EMPTY_HISTORY,
): Map<string, OrderDetail> {
  return kind === "boq" ? boqSummaries(data.boq ?? [], viewer, history) : transferSummaries(kind, data.transfer ?? [], viewer, history);
}

/** Perlu tindakan akun ini. */
export function needsAction(s: OrderSummary): boolean {
  return s.needsAction;
}

/** Menunggu pihak lain: belum Verified dan bukan giliran akun ini (TO keluar tidak termasuk). */
export function isWaiting(s: OrderSummary): boolean {
  return s.status !== "verified" && !s.needsAction && s.canVerify;
}

export function matchesView(s: OrderSummary, view: OrderView): boolean {
  if (view === "todo") return s.needsAction;
  if (view === "waiting") return isWaiting(s);
  if (view === "verified") return s.status === "verified";
  return true;
}

export function matchesQuery(detail: OrderDetail, q: string): boolean {
  const needle = nameKey(q);
  if (!needle) return true;
  const s = detail.summary;
  const hay = [
    s.number,
    s.subcont,
    s.subcontCity,
    s.origin,
    s.destination,
    s.region,
    s.siteName,
    s.boqStatus,
    ...detail.transferLines.map((l) => l.material),
    ...detail.boqLines.map((l) => l.material),
  ];
  return hay.some((h) => nameKey(h).includes(needle));
}

export function kpiOf(items: readonly OrderSummary[]): OrderKpi {
  return {
    documents: items.length,
    action: items.filter(needsAction).length,
    waiting: items.filter(isWaiting).length,
    verified: items.filter((s) => s.status === "verified").length,
    totalQty: items.reduce((acc, s) => acc + s.totalQty, 0),
  };
}

/** Rekap per subcont untuk admin: diurutkan dari yang paling banyak perlu verifikasi. */
export function recapBySubcont(items: readonly OrderSummary[]): SubcontRecap[] {
  const map = new Map<string, SubcontRecap>();
  for (const s of items) {
    const name = s.subcont || "(Tanpa subcont)";
    const k = nameKey(name);
    const r = map.get(k) ?? { subcont: name, documents: 0, action: 0 };
    r.documents++;
    if (needsAction(s)) r.action++;
    map.set(k, r);
  }
  return [...map.values()].sort((a, b) => b.action - a.action || a.subcont.localeCompare(b.subcont, "id"));
}

export interface ListQuery {
  view: OrderView;
  q: string;
  subcont: string;
  /** Filter Region (kosong = semua). */
  region?: string;
  page: number;
  pageSize: number;
  /** Rentang tanggal kirim verifikasi terakhir (epoch ms, [from, to)). Dokumen tanpa verifikasi tidak lolos bila diisi. */
  from?: number;
  to?: number;
}

/** "2026-11-24" (tanggal WIB) → epoch ms awal hari itu. null bila tidak valid. */
export function wibDayStart(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(t) ? t : null;
}

/** Menyaring, mengurutkan (terbaru dulu), dan memotong per halaman. */
export function listDocuments(docs: Map<string, OrderDetail>, query: ListQuery) {
  const all = [...docs.values()];
  const bySubcont = query.subcont ? all.filter((d) => nameKey(d.summary.subcont) === nameKey(query.subcont)) : all;
  const regions = [...new Set(bySubcont.map((d) => d.summary.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  const scoped = query.region ? bySubcont.filter((d) => nameKey(d.summary.region) === nameKey(query.region ?? "")) : bySubcont;
  const kpi = kpiOf(scoped.map((d) => d.summary));
  const filtered = scoped
    .filter((d) => matchesView(d.summary, query.view) && matchesQuery(d, query.q))
    .filter((d) => {
      if (query.from === undefined && query.to === undefined) return true;
      const t = d.summary.latest?.submittedAt ?? 0;
      return t > 0 && (query.from === undefined || t >= query.from) && (query.to === undefined || t < query.to);
    })
    .map((d) => d.summary)
    .sort((a, b) => b.lastRow - a.lastRow);
  const start = (query.page - 1) * query.pageSize;
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    kpi,
    regions,
    subconts: recapBySubcont(all.map((d) => d.summary)),
  };
}
