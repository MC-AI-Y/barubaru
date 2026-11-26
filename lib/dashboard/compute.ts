/**
 * Perhitungan stok SMDT (spesifikasi v5.0 bagian 4.1). Murni (tanpa jaringan).
 *
 * D DO        = QTY DO Verified, tujuan = Subcont City
 * E Borrow    = QTY TO Verified yang masuk (tujuan = Subcont City)
 * F TOTAL In  = D + E
 * G BOQ       = Subcont Qty BOQ Verified milik Subcont City
 * H Handover  = QTY TO Verified yang keluar (asal = Subcont City)
 * I Total Out = G + H
 * J By Data   = F − I
 * K Actual    = Visit terakhir Subcont City (jumlah Quantity per material)
 * L GAP       = J − K
 *
 * "Verified" = baris bertanda Verified di sheet, atau dokumen yang disetujui admin di aplikasi.
 */
import { nameKey } from "../format/text";
import { boqKey, transferKey } from "../orders/parse";
import type { BoqLine, OrderKind, TransferLine } from "../orders/types";
import type { PendingCounts, StockRow, SubcontCityRank, VisitInfo } from "./types";
import { latestVisitByCity, type VisitReport } from "./visit";

type Field = "do" | "borrow" | "boq" | "handover";

interface Acc {
  subcontCity: string;
  subcont: string;
  region: string;
  material: string;
  do: number;
  borrow: number;
  boq: number;
  handover: number;
  inVerified: number;
  outVerified: number;
  v: { do: number; borrow: number; boq: number; handover: number };
}

const blankAcc = (subcontCity: string, subcont: string, region: string, material: string): Acc => ({
  subcontCity,
  subcont,
  region,
  material,
  do: 0,
  borrow: 0,
  boq: 0,
  handover: 0,
  inVerified: 0,
  outVerified: 0,
  v: { do: 0, borrow: 0, boq: 0, handover: 0 },
});

export interface StockInput {
  doLines: readonly TransferLine[];
  toLines: readonly TransferLine[];
  boqLines: readonly BoqLine[];
  visits: readonly VisitReport[];
}

export interface StockResult {
  rows: StockRow[];
  visits: VisitInfo[];
  /** Dokumen belum Verified per Subcont City (kunci nameKey) dan per jenis. */
  pendingByCity: Map<string, PendingCounts & { subcontCity: string; subcont: string }>;
}

/**
 * City dari Subcont City bila kolom City kosong: "HARSO JAKARTA" − "HARSO" → "JAKARTA" (Q3: Subcont + spasi + City).
 * Bila Subcont City tidak diawali nama subcont, City dibiarkan kosong.
 */
export function cityFromSubcontCity(subcontCity: string, subcont: string): string {
  const sc = subcontCity.replace(/\s+/g, " ").trim();
  const s = subcont.replace(/\s+/g, " ").trim();
  if (!s || sc.length <= s.length) return "";
  return nameKey(sc).startsWith(`${nameKey(s)} `) ? sc.slice(s.length).trim() : "";
}

export function computeStock(input: StockInput): StockResult {
  const acc = new Map<string, Acc>();
  const cityInfo = new Map<string, { subcontCity: string; subcont: string; region: string; city: string }>();

  function noteCity(subcontCity: string, subcont: string, region: string, city: string) {
    const k = nameKey(subcontCity);
    if (!k) return;
    const c = city.replace(/\s+/g, " ").trim();
    const cur = cityInfo.get(k);
    if (!cur) cityInfo.set(k, { subcontCity, subcont, region, city: c });
    else {
      if (!cur.subcont && subcont) cur.subcont = subcont;
      if (!cur.region && region) cur.region = region;
      if (!cur.city && c) cur.city = c;
    }
  }

  function add(subcontCity: string, subcont: string, region: string, city: string, material: string, field: Field, qty: number | null, verified: boolean) {
    const ck = nameKey(subcontCity);
    const mk = nameKey(material);
    if (!ck || !mk) return;
    noteCity(subcontCity, subcont, region, city);
    const k = `${ck}|${mk}`;
    let a = acc.get(k);
    if (!a) {
      a = blankAcc(subcontCity, subcont, region, material);
      acc.set(k, a);
    }
    a[field] += qty ?? 0;
    if (verified) {
      a.v[field] += qty ?? 0;
      if (field === "do" || field === "borrow") a.inVerified += qty ?? 0;
      else a.outVerified += qty ?? 0;
    }
  }

  const pendingByCity = new Map<string, PendingCounts & { subcontCity: string; subcont: string }>();
  const pendingSeen = new Set<string>();
  function notePending(kind: OrderKind, docKey: string, subcontCity: string, subcont: string) {
    const ck = nameKey(subcontCity);
    if (!ck || pendingSeen.has(`${kind}|${docKey}|${ck}`)) return;
    pendingSeen.add(`${kind}|${docKey}|${ck}`);
    const p = pendingByCity.get(ck) ?? { do: 0, to: 0, boq: 0, subcontCity, subcont };
    p[kind]++;
    pendingByCity.set(ck, p);
  }

  for (const l of input.doLines) {
    const destCity = l.destSubcontCity || [l.destSubcont, l.destCity].filter(Boolean).join(" ");
    add(destCity, l.destSubcont, l.region, l.destCity, l.material, "do", l.qty, l.verified);
    if (!l.verified) notePending("do", transferKey(l), destCity, l.destSubcont);
  }
  for (const l of input.toLines) {
    const destCity = l.destSubcontCity || [l.destSubcont, l.destCity].filter(Boolean).join(" ");
    const originCity = l.originSubcontCity || [l.originSubcont, l.originCity].filter(Boolean).join(" ");
    add(destCity, l.destSubcont, l.region, l.destCity, l.material, "borrow", l.qty, l.verified);
    add(originCity, l.originSubcont, l.region, l.originCity, l.material, "handover", l.qty, l.verified);
    if (!l.verified) notePending("to", transferKey(l), destCity, l.destSubcont);
  }
  for (const l of input.boqLines) {
    add(l.subcontCity, l.subcont, l.region, l.city, l.material, "boq", l.qty, l.verified);
    if (!l.verified) notePending("boq", boqKey(l), l.subcontCity, l.subcont);
  }

  // Inventory Actual dari Visit terakhir.
  const latest = latestVisitByCity(input.visits);
  for (const rep of latest.values()) {
    noteCity(rep.subcontCity, rep.subcont, "", "");
    for (const { material } of rep.quantities.values()) {
      const k = `${nameKey(rep.subcontCity)}|${nameKey(material)}`;
      if (!acc.has(k)) acc.set(k, blankAcc(rep.subcontCity, rep.subcont, "", material));
    }
  }

  const rows: StockRow[] = [];
  for (const [k, a] of acc) {
    const [ck, mk] = k.split("|") as [string, string];
    const info = cityInfo.get(ck);
    const visit = latest.get(ck);
    const actual = visit ? (visit.quantities.get(mk)?.qty ?? 0) : null;
    const totalIn = a.do + a.borrow;
    const totalOut = a.boq + a.handover;
    const byData = totalIn - totalOut;
    const subcontCity = info?.subcontCity ?? a.subcontCity;
    const subcont = info?.subcont || a.subcont;
    rows.push({
      subcontCity,
      subcont,
      city: info?.city || cityFromSubcontCity(subcontCity, subcont),
      region: info?.region || a.region,
      material: a.material,
      do: a.do,
      borrow: a.borrow,
      totalIn,
      boq: a.boq,
      handover: a.handover,
      totalOut,
      inVerified: a.inVerified,
      outVerified: a.outVerified,
      verifiedPart: a.v,
      inventoryByData: byData,
      inventoryActual: actual,
      gap: actual === null ? null : byData - actual,
    });
  }
  rows.sort((x, y) => x.subcontCity.localeCompare(y.subcontCity, "id") || x.material.localeCompare(y.material, "id"));

  const visits: VisitInfo[] = [...latest.values()]
    .map((r) => ({
      subcontCity: cityInfo.get(nameKey(r.subcontCity))?.subcontCity ?? r.subcontCity,
      subcont: r.subcont,
      lastVisitText: r.submittedText,
      submissionId: r.submissionId,
      materialCount: r.quantities.size,
    }))
    .sort((x, y) => x.subcontCity.localeCompare(y.subcontCity, "id"));

  return { rows, visits, pendingByCity };
}

/** Baris yang ditulis ke SMDT: minimal satu angka tidak nol (spesifikasi 4.2). */
export function hasData(r: StockRow): boolean {
  return [r.do, r.borrow, r.boq, r.handover, r.inventoryActual ?? 0].some((n) => n !== 0);
}

/** Milik akun subcont: nama subcont sama persis; bila kosong, Subcont City diawali nama akun. */
export function ownedBy(account: string, subcont: string, subcontCity: string): boolean {
  const a = nameKey(account);
  if (nameKey(subcont)) return nameKey(subcont) === a;
  return nameKey(subcontCity).startsWith(`${a} `);
}

export function rankCities(result: StockResult): SubcontCityRank[] {
  const map = new Map<string, SubcontCityRank>();
  const get = (subcontCity: string, subcont: string) => {
    const k = nameKey(subcontCity);
    let r = map.get(k);
    if (!r) {
      r = { subcontCity, subcont, absGap: 0, pending: 0, lastVisitText: "" };
      map.set(k, r);
    }
    return r;
  };
  for (const row of result.rows) get(row.subcontCity, row.subcont).absGap += Math.abs(row.gap ?? 0);
  for (const p of result.pendingByCity.values()) get(p.subcontCity, p.subcont).pending += p.do + p.to + p.boq;
  for (const v of result.visits) get(v.subcontCity, v.subcont).lastVisitText = v.lastVisitText;
  return [...map.values()].sort((a, b) => b.absGap - a.absGap || b.pending - a.pending);
}
