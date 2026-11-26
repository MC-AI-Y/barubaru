/**
 * Inventory Actual dari spreadsheet hasil Visit (spesifikasi v5.0 bagian 4.1 kolom K, Q7):
 * laporan Visit TERAKHIR per Subcont City, jumlah Quantity per material dalam laporan itu.
 *
 * Subcont City diambil dari kolom "Subcont City" (kolom U, Tahap 6) bila ada.
 * Bila belum ada, dibentuk dari Subcont + spasi + City untuk laporan yang Region-nya satu kota.
 * Laporan yang mencakup beberapa kota tidak bisa dibagi, sehingga dilewati (dihitung untuk peringatan).
 */
import { cellText, nameKey } from "../format/text";
import { headerNameMatches } from "../google/parse";
import { parseQty } from "../orders/parse";

export interface VisitReport {
  submissionId: string;
  subcont: string;
  subcontCity: string;
  submittedText: string;
  /** Urutan baris pertama laporan di sheet (makin besar = makin baru). */
  order: number;
  /** material (nama asli) → jumlah */
  quantities: Map<string, { material: string; qty: number }>;
}

/** "BOGOR" → ["BOGOR"]; "BOGOR DAN DEPOK" → 2; "A, B, DAN C" → 3. */
export function splitRegion(value: string): string[] {
  const v = cellText(value);
  if (!v) return [];
  return v
    .split(/,\s*|\s+dan\s+/i)
    .map((s) => s.replace(/^dan\s+/i, "").trim())
    .filter(Boolean);
}

function findCol(header: readonly string[], name: string): number {
  return header.findIndex((h) => headerNameMatches(cellText(h), name));
}

export function parseVisitReports(values: readonly (readonly string[])[]): { reports: VisitReport[]; multiCity: number } {
  const header = values[0] ?? [];
  const c = {
    sid: findCol(header, "Submission ID"),
    sub: findCol(header, "Subcont Name"),
    region: findCol(header, "Region"),
    material: findCol(header, "Material"),
    qty: findCol(header, "Quantity"),
    at: findCol(header, "Submitted At (Server)"),
    sc: findCol(header, "Subcont City"),
  };
  // Kolom U (Tahap 6) ditulis aplikasi walau admin belum menambahkan judulnya.
  if (c.sc < 0 && c.at === 19) c.sc = 20;
  if (c.sid < 0 || c.sub < 0 || c.material < 0 || c.qty < 0) return { reports: [], multiCity: 0 };

  const bySid = new Map<string, VisitReport>();
  const multi = new Set<string>();
  for (let i = 1; i < values.length; i++) {
    const r = values[i] ?? [];
    const sid = cellText(r[c.sid]);
    const subcont = cellText(r[c.sub]);
    const material = cellText(r[c.material]);
    if (!sid || !subcont || !material) continue;
    let subcontCity = c.sc >= 0 ? cellText(r[c.sc]) : "";
    if (!subcontCity) {
      const cities = c.region >= 0 ? splitRegion(cellText(r[c.region])) : [];
      if (cities.length !== 1) {
        multi.add(sid);
        continue;
      }
      subcontCity = `${subcont} ${cities[0]}`;
    }
    let rep = bySid.get(sid);
    if (!rep) {
      rep = { submissionId: sid, subcont, subcontCity, submittedText: c.at >= 0 ? cellText(r[c.at]) : "", order: i, quantities: new Map() };
      bySid.set(sid, rep);
    }
    const mk = nameKey(material);
    const q = parseQty(cellText(r[c.qty])) ?? 0;
    const cur = rep.quantities.get(mk);
    if (cur) cur.qty += q;
    else rep.quantities.set(mk, { material, qty: q });
  }
  return { reports: [...bySid.values()], multiCity: multi.size };
}

/** Laporan terakhir per Subcont City (kunci nameKey). */
export function latestVisitByCity(reports: readonly VisitReport[]): Map<string, VisitReport> {
  const map = new Map<string, VisitReport>();
  for (const rep of reports) {
    const k = nameKey(rep.subcontCity);
    const cur = map.get(k);
    if (!cur || rep.order > cur.order) map.set(k, rep);
  }
  return map;
}
