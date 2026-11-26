"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { nameKey } from "@/lib/format/text";
import type { DashboardResponse, StockRow } from "@/lib/dashboard/types";
import { dashboardApi } from "./api";
import { useFlow } from "./flow";
import { qtyText } from "./OrdersScreen";
import styles from "./DashboardScreen.module.css";

/** Warna dua seri grafik (lolos uji palet: kontras ≥ 3:1, aman buta warna). */
const C_A = "#0080b8";
const C_B = "#d97a00";
const PAGE = 50;

type SortKey = keyof Pick<StockRow, "subcontCity" | "material" | "totalIn" | "totalOut" | "inventoryByData" | "inventoryActual" | "gap">;

const COLUMNS: { key: keyof StockRow; label: string; num?: boolean }[] = [
  { key: "subcontCity", label: "Subcont City" },
  { key: "material", label: "Material" },
  { key: "do", label: "DO", num: true },
  { key: "borrow", label: "Borrow", num: true },
  { key: "totalIn", label: "Total In", num: true },
  { key: "boq", label: "BOQ", num: true },
  { key: "handover", label: "Handover", num: true },
  { key: "totalOut", label: "Total Out", num: true },
  { key: "inventoryByData", label: "By Data", num: true },
  { key: "inventoryActual", label: "Actual", num: true },
  { key: "gap", label: "GAP", num: true },
];

/** Cocok dengan filter: filter kosong = semua; tanpa beda huruf besar/kecil/spasi. */
function same(value: string, filter: string): boolean {
  return !filter || nameKey(value) === nameKey(filter);
}

/** Nilai unik (tanpa beda huruf besar/kecil/spasi), kosong dibuang, urut abjad. */
function uniqueSorted(values: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const k = nameKey(v);
    if (k && !seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "id"));
}

function signed(n: number | null): string {
  if (n === null) return "-";
  return n > 0 ? `+${qtyText(n)}` : qtyText(n);
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Cegah teks dibaca Excel sebagai rumus (CSV injection). Angka tetap angka.
  if (typeof v === "string" && /^[=+@\-]/.test(s)) s = `'${s}`;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Agregasi per material untuk grafik. */
function byMaterial(rows: readonly StockRow[]) {
  const map = new Map<string, { material: string; totalIn: number; totalOut: number; byData: number; actual: number; hasActual: boolean }>();
  for (const r of rows) {
    const k = nameKey(r.material);
    const m = map.get(k) ?? { material: r.material, totalIn: 0, totalOut: 0, byData: 0, actual: 0, hasActual: false };
    m.totalIn += r.totalIn;
    m.totalOut += r.totalOut;
    if (r.inventoryActual !== null) {
      m.byData += r.inventoryByData;
      m.actual += r.inventoryActual;
      m.hasActual = true;
    }
    map.set(k, m);
  }
  return [...map.values()];
}

function PairedBars({
  title,
  items,
  labelA,
  labelB,
  empty,
}: {
  title: string;
  items: { label: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
  empty: string;
}) {
  const max = Math.max(1, ...items.flatMap((i) => [Math.abs(i.a), Math.abs(i.b)]));
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <div className={styles.legend} aria-hidden="true">
          <span>
            <i style={{ background: C_A }} />
            {labelA}
          </span>
          <span>
            <i style={{ background: C_B }} />
            {labelB}
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.bars}>
          {items.map((it) => (
            <li key={it.label} className={styles.barRow}>
              <span className={styles.barLabel} title={it.label}>
                {it.label}
              </span>
              <span className={styles.barPair}>
                <span className={styles.barLine} title={`${it.label} · ${labelA}: ${qtyText(it.a)}`}>
                  <span className={styles.bar} style={{ width: `${(Math.abs(it.a) / max) * 100}%`, background: C_A }} />
                  <span className={styles.barValue}>{qtyText(it.a)}</span>
                </span>
                <span className={styles.barLine} title={`${it.label} · ${labelB}: ${qtyText(it.b)}`}>
                  <span className={styles.bar} style={{ width: `${(Math.abs(it.b) / max) * 100}%`, background: C_B }} />
                  <span className={styles.barValue}>{qtyText(it.b)}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stock by Data vs Stock Visit per material, dengan angka GAP (By Data − Visit) di kanan. */
function StockVisitBars({ items }: { items: { label: string; data: number; visit: number }[] }) {
  const max = Math.max(1, ...items.flatMap((i) => [Math.abs(i.data), Math.abs(i.visit)]));
  return (
    <section className={styles.panel} aria-label="Stock by Data vs Stock Visit per material">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Stock by Data vs Stock Visit</h2>
        <div className={styles.legend} aria-hidden="true">
          <span>
            <i style={{ background: C_A }} />
            Stock by Data
          </span>
          <span>
            <i style={{ background: C_B }} />
            Stock Visit
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>Belum ada laporan Visit untuk dibandingkan.</p>
      ) : (
        <ul className={styles.bars}>
          {items.map((it) => {
            const gap = it.data - it.visit;
            return (
              <li key={it.label} className={`${styles.barRow} ${styles.barRowGap}`}>
                <span className={styles.barLabel} title={it.label}>
                  {it.label}
                </span>
                <span className={styles.barPair}>
                  <span className={styles.barLine} title={`${it.label} · Stock by Data: ${qtyText(it.data)}`}>
                    <span className={styles.bar} style={{ width: `${(Math.abs(it.data) / max) * 100}%`, background: C_A }} />
                    <span className={styles.barValue}>{qtyText(it.data)}</span>
                  </span>
                  <span className={styles.barLine} title={`${it.label} · Stock Visit: ${qtyText(it.visit)}`}>
                    <span className={styles.bar} style={{ width: `${(Math.abs(it.visit) / max) * 100}%`, background: C_B }} />
                    <span className={styles.barValue}>{qtyText(it.visit)}</span>
                  </span>
                </span>
                <span className={styles.gapCell} title="GAP = Stock by Data − Stock Visit">
                  <span className={gap > 0 ? styles.gapShort : gap < 0 ? styles.gapOver : styles.gapZero}>{signed(gap)}</span>
                  <span className={styles.gapHint}>{gap > 0 ? "kurang di gudang" : gap < 0 ? "lebih di gudang" : "sesuai"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function DashboardScreen() {
  const { session, go, expireSession } = useFlow();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = session?.role === "admin";
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [region, setRegion] = useState("");
  const [subcont, setSubcont] = useState("");
  const [city, setCity] = useState("");
  const [material, setMaterial] = useState("");
  const [query, setQuery] = useState("");
  const [onlyGap, setOnlyGap] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "subcontCity", dir: 1 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      const res = await dashboardApi.get(refresh);
      setLoading(false);
      if (res.ok) setData(res.data);
      else if (res.status === 401) expireSession();
      else setError(res.message);
    },
    [expireSession],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function syncSmdt() {
    const ok = await confirm({
      title: "Perbarui sheet SMDT?",
      message: "Isi sheet SMDT → Stock (mulai baris data) ditulis ulang dari hasil hitung terbaru. Kolom Remarks yang diisi manual tetap dipertahankan.",
      confirmLabel: "Perbarui SMDT",
    });
    if (!ok) return;
    setSyncing(true);
    const res = await dashboardApi.syncSmdt();
    setSyncing(false);
    if (res.ok) {
      toast.show(`SMDT diperbarui: ${res.data.written} baris ditulis, ${res.data.remarksKept} Remarks dipertahankan.`, "success");
      void load();
    } else if (res.status === 401) expireSession();
    else toast.show(res.message, "error");
  }

  const allRows = data?.rows ?? [];
  /** Filter saling menyaring: Region → Subcont → City → Material. Pencocokan tanpa beda huruf besar/kecil/spasi. */
  const inRegion = useMemo(() => allRows.filter((r) => same(r.region, region)), [allRows, region]);
  const inSubcont = useMemo(() => inRegion.filter((r) => same(r.subcont, subcont)), [inRegion, subcont]);
  const inCity = useMemo(() => inSubcont.filter((r) => same(r.city, city)), [inSubcont, city]);
  const regions = useMemo(() => uniqueSorted(allRows.map((r) => r.region)), [allRows]);
  const subconts = useMemo(() => uniqueSorted(inRegion.map((r) => r.subcont)), [inRegion]);
  const cities = useMemo(() => uniqueSorted(inSubcont.map((r) => r.city)), [inSubcont]);
  const materials = useMemo(() => uniqueSorted(inCity.map((r) => r.material)), [inCity]);

  // Pilihan yang tidak ada lagi setelah filter di atasnya berubah dikosongkan otomatis.
  useEffect(() => {
    if (!data) return;
    if (subcont && !subconts.some((v) => nameKey(v) === nameKey(subcont))) setSubcont("");
    else if (city && !cities.some((v) => nameKey(v) === nameKey(city))) setCity("");
    else if (material && !materials.some((v) => nameKey(v) === nameKey(material))) setMaterial("");
  }, [data, subcont, subconts, city, cities, material, materials]);

  const filtered = useMemo(() => inCity.filter((r) => same(r.material, material)), [inCity, material]);

  /** Revisi 8: stok selalu dihitung dari semua dokumen, termasuk yang belum diverifikasi. */
  const viewRows = filtered;

  const mats = useMemo(() => byMaterial(viewRows), [viewRows]);
  const inOut = useMemo(
    () =>
      [...mats]
        .sort((a, b) => b.totalIn + b.totalOut - (a.totalIn + a.totalOut))
        .slice(0, 10)
        .map((m) => ({ label: m.material, a: m.totalIn, b: m.totalOut })),
    [mats],
  );
  const dataActual = useMemo(
    () =>
      mats
        .filter((m) => m.hasActual)
        .sort((a, b) => Math.abs(b.byData - b.actual) - Math.abs(a.byData - a.actual))
        .slice(0, 10)
        .map((m) => ({ label: m.material, data: m.byData, visit: m.actual })),
    [mats],
  );

  const tableRows = useMemo(() => {
    const q = nameKey(query);
    const list = viewRows.filter(
      (r) => (!onlyGap || (r.gap !== null && r.gap !== 0)) && (!q || nameKey(`${r.subcontCity} ${r.material}`).includes(q)),
    );
    const { key, dir } = sort;
    return list.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y, "id") * dir;
      return ((x ?? -Infinity) > (y ?? -Infinity) ? 1 : (x ?? -Infinity) < (y ?? -Infinity) ? -1 : 0) * dir;
    });
  }, [viewRows, query, onlyGap, sort]);

  useEffect(() => setPage(1), [region, subcont, city, material, query, onlyGap, sort]);

  function toggleSort(key: keyof StockRow) {
    const k = key as SortKey;
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: typeof allRows[0]?.[k] === "string" ? 1 : -1 }));
  }

  function downloadCsv() {
    const head = ["No", "Subcont City", "Material Name", "DO", "Borrow", "TOTAL In", "BOQ", "Handover", "Total Use/Out", "Inventory By Data", "Inventory Actual", "GAP", "In Terverifikasi", "Out Terverifikasi"];
    const lines = tableRows.map((r, i) =>
      [i + 1, r.subcontCity, r.material, r.do, r.borrow, r.totalIn, r.boq, r.handover, r.totalOut, r.inventoryByData, r.inventoryActual ?? "", r.gap ?? "", r.inVerified, r.outVerified]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WHControl-Stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const pageRows = tableRows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE));

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>Dashboard</p>
            <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
              Stock Material
            </h1>
            <p className={styles.description}>
              {isAdmin
                ? "Stok per Subcont City dari semua DO, TO, dan BOQ (termasuk yang belum diverifikasi), dibandingkan dengan Visit terakhir."
                : "Stok gudang Anda dari semua DO, TO, dan BOQ (termasuk yang belum diverifikasi), dibandingkan dengan laporan Visit terakhir."}
            </p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className={styles.iconBtn} onClick={() => go("home")}>
              <Icon name="arrowLeft" size={18} />
              <span>Beranda</span>
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => void load(true)} disabled={loading}>
              <Icon name="refresh" size={18} />
              <span>Muat ulang</span>
            </button>
            {isAdmin ? (
              <Button size="md" icon={<Icon name="send" />} loading={syncing} onClick={() => void syncSmdt()} disabled={loading || !data}>
                Perbarui SMDT
              </Button>
            ) : null}
          </div>
        </div>

        {data?.warnings.map((w) => (
          <p key={w} className={styles.warn} role="status">
            <Icon name="alert" size={16} />
            {w}
          </p>
        ))}

        {loading && !data ? (
          <div className={styles.state}>
            <Spinner size={24} label="Memuat" />
            <span>Menghitung stok dari DO, TO, BOQ, dan Visit…</span>
          </div>
        ) : error ? (
          <div className={`${styles.state} ${styles.stateError}`} role="alert">
            <Icon name="alert" size={22} />
            <span>{error}</span>
            <Button size="md" variant="secondary" onClick={() => void load(true)}>
              Coba lagi
            </Button>
          </div>
        ) : data ? (
          <>
            <div className={styles.filters}>
              <SearchSelect value={region} options={regions} onChange={setRegion} allLabel="Semua region" ariaLabel="Filter region" />
              <SearchSelect value={subcont} options={subconts} onChange={setSubcont} allLabel="Semua subcont" ariaLabel="Filter subcont" />
              <SearchSelect value={city} options={cities} onChange={setCity} allLabel="Semua city" ariaLabel="Filter city" />
              <SearchSelect value={material} options={materials} onChange={setMaterial} allLabel="Semua material" ariaLabel="Filter material" />
            </div>

            <div className={styles.grid2}>
              <PairedBars title="In vs Out per material" items={inOut} labelA="Total In" labelB="Total Out" empty="Belum ada DO, TO, atau BOQ." />
              <StockVisitBars items={dataActual} />
            </div>

            <section className={styles.panel} aria-label="Tabel detail">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Tabel detail ({tableRows.length})</h2>
                <div className={styles.tableTools}>
                  <label className={styles.search}>
                    <Icon name="search" size={16} />
                    <input
                      type="search"
                      value={query}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                      placeholder="Cari kota atau material…"
                      aria-label="Cari di tabel"
                    />
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={onlyGap} onChange={(e: ChangeEvent<HTMLInputElement>) => setOnlyGap(e.target.checked)} />
                    Hanya yang ber-GAP
                  </label>
                  <Button size="md" variant="secondary" icon={<Icon name="download" />} onClick={downloadCsv} disabled={!tableRows.length}>
                    Unduh CSV
                  </Button>
                </div>
              </div>
              {tableRows.length === 0 ? (
                <p className={styles.empty}>Tidak ada data yang cocok.</p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.detail}`}>
                      <thead>
                        <tr>
                          {COLUMNS.map((c) => (
                            <th key={c.key} className={c.num ? styles.num : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                              <button type="button" className={styles.sortBtn} onClick={() => toggleSort(c.key)}>
                                {c.label}
                                {sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r) => (
                          <tr key={`${r.subcontCity}|${r.material}`}>
                            <td>{r.subcontCity}</td>
                            <td>{r.material}</td>
                            <td className={styles.num}>{qtyText(r.do)}</td>
                            <td className={styles.num}>{qtyText(r.borrow)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>
                              {qtyText(r.totalIn)}
                              {r.totalIn !== r.inVerified ? <span className={styles.cellSub}>✓ {qtyText(r.inVerified)}</span> : null}
                            </td>
                            <td className={styles.num}>{qtyText(r.boq)}</td>
                            <td className={styles.num}>{qtyText(r.handover)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>
                              {qtyText(r.totalOut)}
                              {r.totalOut !== r.outVerified ? <span className={styles.cellSub}>✓ {qtyText(r.outVerified)}</span> : null}
                            </td>
                            <td className={`${styles.num} ${styles.strong}`}>{qtyText(r.inventoryByData)}</td>
                            <td className={styles.num}>{r.inventoryActual === null ? "-" : qtyText(r.inventoryActual)}</td>
                            <td className={`${styles.num} ${r.gap ? ((r.gap ?? 0) > 0 ? styles.gapShort : styles.gapOver) : ""}`}>{signed(r.gap)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pages > 1 ? (
                    <div className={styles.pager}>
                      <button type="button" className={styles.iconBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        <Icon name="arrowLeft" size={16} />
                        <span>Sebelumnya</span>
                      </button>
                      <span>
                        Halaman {page} / {pages}
                      </span>
                      <button type="button" className={styles.iconBtn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                        <span>Berikutnya</span>
                        <Icon name="arrowRight" size={16} />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              <p className={styles.note}>
                Angka termasuk dokumen yang belum diverifikasi; ✓ = bagian yang sudah terverifikasi.{" "}
                GAP positif = stok di gudang kurang dari data; negatif = lebih dari data. Data dihitung pukul {new Date(data.computedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":")}.</p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
