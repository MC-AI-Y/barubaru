import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransferSheet, parseBoqSheet } from "../orders/parse";
import { cityFromSubcontCity, computeStock, hasData, ownedBy, rankCities } from "./compute";
import { latestVisitByCity, parseVisitReports, splitRegion } from "./visit";
import { locateSmdtHeader } from "./smdt";

const TH = (n: string) => [n, "WH/SUPPLIER ORIGIN", "WH NAME/SUPPLIER CITY ORIGIN", "WH/SUPPLIER DESTINATION", "WH NAME/SUPPLIER CITY DESTINATION", "REGION", "MATERIAL NAME", "QTY", "Verified"];
const doLines = parseTransferSheet(
  [
    TH("DO NUMBER"),
    ["DO1", "YOFC", "YOFC CKR", "CV A", "CV A BOGOR", "Jabodetabek", "CABLE-48", "1000", "Verified"],
    ["DO1", "YOFC", "YOFC CKR", "CV A", "CV A BOGOR", "Jabodetabek", "FDT-48", "5", "Verified"],
    ["DO2", "YOFC", "YOFC CKR", "CV A", "CV A BOGOR", "Jabodetabek", "CABLE-48", "300", ""],
    ["DO3", "YOFC", "YOFC CKR", "CV A", "CV A BOGOR", "Jabodetabek", "CABLE-48", "50", ""],
  ],
  "do",
);
const toLines = parseTransferSheet([TH("TO NUMBER"), ["TO1", "CV A", "CV A BOGOR", "CV B", "CV B DEPOK", "Jabodetabek", "CABLE-48", "200", "Verified"]], "to");
const boqLines = parseBoqSheet([
  ["Verified", "Subcont", "City", "Site Name", "Material Name", "QTY"],
  ["APD", "CV A", "BOGOR", "S1", "CABLE-48", "300"],
  ["", "CV A", "BOGOR", "S2", "CABLE-48", "100"],
]);
const VH = ["Submission ID", "Subcont", "Region", "Material", "Quantity", "Submitted At (Server)"];
const visitValues = [
  VH,
  ["s1", "CV A", "BOGOR", "CABLE-48", "900", "20/11/2026 10:00"],
  ["s2", "CV A", "BOGOR DAN DEPOK", "CABLE-48", "1", "21/11/2026 10:00"],
  ["s3", "CV A", "BOGOR", "CABLE-48", "400", "22/11/2026 10:00"],
  ["s3", "CV A", "BOGOR", "CABLE-48", "50", "22/11/2026 10:00"],
  ["s3", "CV A", "BOGOR", "FDT-48", "5", "22/11/2026 10:00"],
];

test("splitRegion", () => {
  assert.deepEqual(splitRegion("BOGOR"), ["BOGOR"]);
  assert.deepEqual(splitRegion("BOGOR DAN DEPOK"), ["BOGOR", "DEPOK"]);
  assert.deepEqual(splitRegion("BANTUL, KEDIRI, DAN MAKASSAR"), ["BANTUL", "KEDIRI", "MAKASSAR"]);
});

test("Visit: laporan banyak kota dilewati; laporan terakhir per Subcont City; Quantity dijumlah", () => {
  const { reports, multiCity } = parseVisitReports(visitValues);
  assert.equal(multiCity, 1);
  const latest = latestVisitByCity(reports).get("cv a bogor")!;
  assert.equal(latest.submissionId, "s3");
  assert.equal(latest.quantities.get("cable-48")!.qty, 450);
  // kolom Subcont City (Tahap 6) dipakai bila ada
  const withU = parseVisitReports([[...VH, "Subcont City"], ["s9", "CV A", "BOGOR DAN DEPOK", "CABLE-48", "7", "x", "CV A DEPOK"]]);
  assert.equal(withU.multiCity, 0);
  assert.equal(withU.reports[0]!.subcontCity, "CV A DEPOK");
});

test("computeStock: semua dokumen dihitung, bagian terverifikasi dicatat terpisah", () => {
  const { reports } = parseVisitReports(visitValues);
  const res = computeStock({ doLines, toLines, boqLines, visits: reports });
  const row = (city: string, mat: string) => res.rows.find((r) => r.subcontCity === city && r.material === mat)!;
  const a = row("CV A BOGOR", "CABLE-48");
  assert.equal(a.do, 1350); // DO2 dan DO3 belum diverifikasi tetapi ikut dihitung (revisi 8)
  assert.equal(a.borrow, 0);
  assert.equal(a.totalIn, 1350);
  assert.equal(a.inVerified, 1000);
  assert.equal(a.boq, 400); // QTY BOQ (APD 300 + belum diverifikasi 100)
  assert.equal(a.handover, 200); // TO keluar
  assert.equal(a.totalOut, 600);
  assert.equal(a.outVerified, 500);
  assert.deepEqual(a.verifiedPart, { do: 1000, borrow: 0, boq: 300, handover: 200 });
  assert.equal(a.inventoryByData, 750);
  assert.equal(a.inventoryActual, 450);
  assert.equal(a.gap, 300);
  assert.equal(a.region, "Jabodetabek");
  assert.equal(a.subcont, "CV A");
  assert.equal(a.city, "BOGOR"); // tanpa kolom City: dari Subcont City − nama subcont
  const b = row("CV B DEPOK", "CABLE-48");
  assert.equal(b.city, "DEPOK");
  assert.equal(b.borrow, 200);
  assert.equal(b.inventoryActual, null);
  assert.equal(b.gap, null);
  assert.equal(row("CV A BOGOR", "FDT-48").gap, 0);
  const p = res.pendingByCity.get("cv a bogor")!;
  assert.deepEqual([p.do, p.to, p.boq], [2, 0, 1]);
  assert.equal(res.visits[0]!.submissionId, "s3");
  const rank = rankCities(res);
  assert.equal(rank[0]!.subcontCity, "CV A BOGOR");
  assert.equal(rank[0]!.pending, 3);
});

test("hasData, ownedBy, locateSmdtHeader", () => {
  const res = computeStock({ doLines, toLines, boqLines, visits: [] });
  assert.ok(res.rows.every(hasData));
  assert.ok(ownedBy("cv a", "CV A", "CV A BOGOR"));
  assert.ok(!ownedBy("cv a", "CV AB", "CV AB BOGOR"));
  assert.ok(ownedBy("cv a", "", "CV A BOGOR"));
  const h = locateSmdtHeader([["", "", "", "Material Receive/In"], ["No", "Subcont City", "Material Name", "DO", "Borrow", "TOTAL In", "BOQ", "Handover", "Total Use/Out", "Inventory By Data", "Inventory Actual", "GAP", "Remarks"]]);
  assert.deepEqual(h, { headerIndex: 1, remarksCol: 12, cityCol: 1, materialCol: 2 });
});

test("City: dari kolom City bila ada, cadangan dari Subcont City", () => {
  assert.equal(cityFromSubcontCity("HARSO JAKARTA", "HARSO"), "JAKARTA");
  assert.equal(cityFromSubcontCity("PT  Wibisono  Riandi BEKASI", "pt wibisono riandi"), "BEKASI");
  assert.equal(cityFromSubcontCity("HARSO", "HARSO"), "");
  assert.equal(cityFromSubcontCity("CV LAIN BOGOR", "HARSO"), "");
  const lines = parseTransferSheet(
    [
      ["DO NUMBER", "WH/SUPPLIER DESTINATION", "CITY/SUPPLIER NAME DESTINATION", "WH NAME/SUPPLIER CITY DESTINATION", "REGION", "MATERIAL NAME", "QTY", "Verified"],
      ["DO9", "CV A", "Kab. Bogor", "CV A BOGOR", "Jabodetabek", "CABLE-48", "10", ""],
    ],
    "do",
  );
  const res = computeStock({ doLines: lines, toLines: [], boqLines: [], visits: [] });
  assert.equal(res.rows[0]!.city, "Kab. Bogor");
});
