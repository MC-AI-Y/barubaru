import { test } from "node:test";
import assert from "node:assert/strict";
import { SheetFormatError } from "../google/parse";
import { boqKey, displayRemark, isVerifiedCell, parseBoqSheet, parseQty, parseTransferSheet } from "./parse";
import { belongsTo, buildDocuments, listDocuments } from "./access";

const DO_HEADER = [
  "DO NUMBER", "WH/SUPPLIER ORIGIN", "CITY/SUPPLIER NAME ORIGIN", "WH NAME/SUPPLIER CITY ORIGIN",
  "WH/SUPPLIER DESTINATION", "CITY/SUPPLIER NAME DESTINATION", "WH NAME/SUPPLIER CITY DESTINATION",
  "REGION", "MATERIAL NAME", "QTY", "Verified",
];
const doRow = (no: string, dest: string, city: string, mat: string, qty: string, ver = "") =>
  [no, "YOFC WH", "CIKARANG", "YOFC WH CIKARANG", dest, city, `${dest} ${city}`, "Jabodetabek", mat, qty, ver];

test("parseQty menerima pemisah ribuan dan desimal", () => {
  assert.equal(parseQty("1200"), 1200);
  assert.equal(parseQty("1.200"), 1200);
  assert.equal(parseQty("1,200"), 1200);
  assert.equal(parseQty("1 200"), 1200);
  assert.equal(parseQty("12,5"), 12.5);
  assert.equal(parseQty("12.5"), 12.5);
  assert.equal(parseQty("1.234.567"), 1234567);
  assert.equal(parseQty("1,234.5"), 1234.5);
  assert.equal(parseQty(""), null);
  assert.equal(parseQty("abc"), null);
});

test("isVerifiedCell: teks Verified atau centang", () => {
  assert.ok(isVerifiedCell("Verified"));
  assert.ok(isVerifiedCell(" verified "));
  assert.ok(isVerifiedCell("TRUE"));
  assert.ok(!isVerifiedCell(""));
  assert.ok(!isVerifiedCell("FALSE"));
  assert.ok(!isVerifiedCell("Pending"));
});

test("parseTransferSheet: judul di baris 2, urutan kolom bebas, baris kosong dilewati", () => {
  const shuffled = [...DO_HEADER].reverse();
  const values = [
    ["Rekap DO 2026"],
    shuffled,
    [...doRow("DO-001", "CV DAYA ABADI", "BOGOR", "CABLE-48", "1.200")].reverse(),
    [],
    [...doRow("DO-001", "CV DAYA ABADI", "BOGOR", "FDT-48", "2", "Verified")].reverse(),
  ];
  const lines = parseTransferSheet(values, "do");
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.row, 3);
  assert.equal(lines[0]!.qty, 1200);
  assert.equal(lines[0]!.destSubcontCity, "CV DAYA ABADI BOGOR");
  assert.equal(lines[1]!.verified, true);
});

test("parseTransferSheet: judul kolom hilang menyebut nama kolom", () => {
  const header = DO_HEADER.filter((h) => h !== "QTY");
  assert.throws(() => parseTransferSheet([header], "do"), (e: unknown) => e instanceof SheetFormatError && /"QTY"/.test(e.message));
  assert.throws(() => parseTransferSheet([["foo"]], "to"), /TO NUMBER/);
});

test("DO: subcont tujuan melihat, subcont lain tidak; admin melihat semua", () => {
  const lines = parseTransferSheet(
    [
      DO_HEADER,
      doRow("DO-001", "CV DAYA ABADI", "BOGOR", "CABLE-48", "100"),
      doRow("DO-001", "CV DAYA ABADI", "BOGOR", "FDT-48", "2", "Verified"),
      doRow("DO-002", "CV DAYA ABADI", "DEPOK", "CABLE-24", "50", "Verified"),
      doRow("DO-003", "PT LAIN", "MEDAN", "CABLE-24", "70"),
    ],
    "do",
  );
  const mine = buildDocuments("do", { transfer: lines }, { subcontName: "cv daya  abadi", role: "subcont" });
  assert.deepEqual([...mine.keys()].sort(), ["do-001", "do-002"]);
  const d1 = mine.get("do-001")!.summary;
  assert.equal(d1.status, "open");
  assert.equal(d1.partial, true);
  assert.equal(d1.materialCount, 2);
  assert.equal(d1.totalQty, 102);
  assert.equal(mine.get("do-002")!.summary.status, "verified");

  const admin = buildDocuments("do", { transfer: lines }, { subcontName: "admin", role: "admin" });
  assert.equal(admin.size, 3);

  const list = listDocuments(admin, { view: "todo", q: "", subcont: "", page: 1, pageSize: 20 });
  // Admin: "perlu tindakan" = Menunggu Admin (belum ada); 2 dokumen menunggu subcont.
  assert.deepEqual(list.items.map((s) => s.number), []);
  assert.deepEqual(list.kpi, { documents: 3, action: 0, waiting: 2, verified: 1, totalQty: 222 });
  const waitingList = listDocuments(admin, { view: "waiting", q: "", subcont: "", page: 1, pageSize: 20 });
  assert.deepEqual(waitingList.items.map((s) => s.number), ["DO-003", "DO-001"]); // terbaru dulu
  assert.equal(list.subconts[0]!.subcont, "CV DAYA ABADI");
  const scoped = listDocuments(admin, { view: "all", q: "cable-24", subcont: "pt lain", page: 1, pageSize: 20 });
  assert.deepEqual(scoped.items.map((s) => s.number), ["DO-003"]);
});

test("TO: tujuan memverifikasi (masuk), asal hanya melihat (keluar)", () => {
  const header = DO_HEADER.map((h) => (h === "DO NUMBER" ? "TO NUMBER" : h));
  const row = ["TO-9", "CV DAYA ABADI", "BOGOR", "CV DAYA ABADI BOGOR", "PT BAHTERA", "MEDAN", "PT BAHTERA MEDAN", "Sumatera", "CABLE-48", "300", ""];
  const lines = parseTransferSheet([header, row], "to");
  const dest = buildDocuments("to", { transfer: lines }, { subcontName: "PT BAHTERA", role: "subcont" }).get("to-9")!.summary;
  assert.equal(dest.direction, "in");
  assert.equal(dest.canVerify, true);
  const origin = buildDocuments("to", { transfer: lines }, { subcontName: "CV DAYA ABADI", role: "subcont" }).get("to-9")!.summary;
  assert.equal(origin.direction, "out");
  assert.equal(origin.canVerify, false);
  const docs = buildDocuments("to", { transfer: lines }, { subcontName: "CV DAYA ABADI", role: "subcont" });
  assert.equal(listDocuments(docs, { view: "todo", q: "", subcont: "", page: 1, pageSize: 20 }).total, 0);
  assert.equal(listDocuments(docs, { view: "all", q: "", subcont: "", page: 1, pageSize: 20 }).total, 1);
});

const BOQ_HEADER = ["PIC Name", "Photo Evidence PIC", "Site Name", "Subcont", "City", "Subcont City", "Region", "Site Type", "Status", "Material Name", "QTY", "Verified"];

test("BOQ format sederhana: dikelompokkan per Site Name + Subcont City; status dari kolom Verified", () => {
  const r = (site: string, mat: string, qty: string, ver = "") => ["", "", site, "CV DAYA ABADI", "BOGOR", "", "Jawa Barat", "Distribution", "RFSC", mat, qty, ver];
  const lines = parseBoqSheet([BOQ_HEADER, r("CBN-01", "CABLE-48", "1.000"), r("CBN-01", "FDT-48", "2"), r("CBN-02", "CABLE-48", "500", "APD"), r("CBN-03", "FAT", "3", "FO CUT / VANDALISME"), r("CBN-04", "FAT", "1", "NEED CHECK")]);
  assert.equal(lines.length, 5);
  assert.equal(lines[0]!.subcontCity, "CV DAYA ABADI BOGOR");
  assert.equal(lines[0]!.region, "Jawa Barat");
  assert.equal(lines[0]!.qty, 1000);
  assert.equal(lines[2]!.verified, true);
  const docs = buildDocuments("boq", { boq: lines }, { subcontName: "CV DAYA ABADI", role: "subcont" });
  assert.equal(docs.size, 4);
  const cbn1 = docs.get(boqKey(lines[0]!))!.summary;
  assert.equal(cbn1.number, "CBN-01");
  assert.equal(cbn1.materialCount, 2);
  assert.equal(cbn1.totalQty, 1002);
  assert.equal(cbn1.status, "open");
  assert.equal(cbn1.statusLabel, "");
  assert.equal(cbn1.needsAction, true);
  const cbn2 = docs.get(boqKey(lines[2]!))!.summary;
  assert.deepEqual([cbn2.status, cbn2.statusLabel], ["verified", "APD"]);
  const cbn3 = docs.get(boqKey(lines[3]!))!.summary;
  assert.deepEqual([cbn3.status, cbn3.statusLabel, cbn3.needsAction], ["verified", "FO CUT / VANDALISME", false]);
  // Nilai lama NEED CHECK bukan pilihan BOQ v5.3: tampil apa adanya, subcont bisa memverifikasi lagi.
  const cbn4 = docs.get(boqKey(lines[4]!))!.summary;
  assert.deepEqual([cbn4.status, cbn4.statusLabel, cbn4.needsAction], ["open", "NEED CHECK", true]);
  // Admin tidak punya antrean BOQ (tidak ada tahap menunggu admin).
  const admin = buildDocuments("boq", { boq: lines }, { subcontName: "admin", role: "admin" });
  assert.equal([...admin.values()].filter((d) => d.summary.needsAction).length, 0);
  assert.equal(buildDocuments("boq", { boq: lines }, { subcontName: "PT LAIN", role: "subcont" }).size, 0);
  assert.throws(() => parseBoqSheet([BOQ_HEADER.filter((h) => h !== "QTY")]), /"QTY"/);
});

test("Status DO v5.3: ON DELIVERY, RECEIVED, APPROVED, NEED CHECK; nilai lama tetap dikenali", () => {
  const H = [...DO_HEADER, "PIC Name", "Photo Evidence PIC"];
  const row = (no: string, ver: string) => [...doRow(no, "CV A", "BOGOR", "CABLE-48", "10", ver), "Budi (0812)", "https://x"];
  const lines = parseTransferSheet(
    [H, row("D1", "RECEIVED"), row("D2", "approved"), row("D3", "NEED CHECK"), row("D4", "Cek ulang"), row("D5", ""), row("D6", "ON DELIVERY"), row("D7", "VERIFIED"), row("D8", "WAIT ADMIN")],
    "do",
  );
  const sub = buildDocuments("do", { transfer: lines }, { subcontName: "CV A", role: "subcont" });
  const st = (k: string) => [sub.get(k)!.summary.status, sub.get(k)!.summary.statusLabel, sub.get(k)!.summary.needsAction];
  assert.deepEqual(st("d1"), ["pending", "RECEIVED", false]);
  assert.deepEqual(st("d2"), ["verified", "APPROVED", false]);
  assert.deepEqual(st("d3"), ["rejected", "NEED CHECK", true]);
  assert.deepEqual(st("d4"), ["open", "CEK ULANG", true]);
  assert.deepEqual(st("d5"), ["open", "", true]);
  assert.deepEqual(st("d6"), ["open", "ON DELIVERY", true]);
  assert.deepEqual(st("d7"), ["verified", "VERIFIED", false]);
  assert.deepEqual(st("d8"), ["pending", "WAIT ADMIN", false]);
  assert.equal(sub.get("d1")!.summary.picName, "Budi (0812)");
  const admin = buildDocuments("do", { transfer: lines }, { subcontName: "admin", role: "admin" });
  assert.deepEqual([...admin.values()].filter((d) => d.summary.needsAction).map((d) => d.summary.number), ["D1", "D8"]);
});

test("Filter region dan daftar pilihan region", () => {
  const lines = parseTransferSheet(
    [DO_HEADER, doRow("A1", "CV A", "BOGOR", "CABLE-48", "1"), [...doRow("A2", "CV A", "MEDAN", "CABLE-48", "1").slice(0, 7), "Sumatera", "CABLE-48", "1", ""]],
    "do",
  );
  const docs = buildDocuments("do", { transfer: lines }, { subcontName: "CV A", role: "subcont" });
  const q = { view: "all" as const, q: "", subcont: "", page: 1, pageSize: 20 };
  assert.deepEqual(listDocuments(docs, q).regions, ["Jabodetabek", "Sumatera"]);
  assert.deepEqual(listDocuments(docs, { ...q, region: "sumatera" }).items.map((s) => s.number), ["A2"]);
});

test("belongsTo dan displayRemark", () => {
  assert.ok(belongsTo("CV Daya Abadi", "", "CV DAYA ABADI BOGOR"));
  assert.ok(belongsTo("CV DAYA ABADI", "CV DAYA ABADI", "CV DAYA ABADI BOGOR"));
  assert.ok(!belongsTo("CV DAYA", "CV DAYA ABADI", "CV DAYA ABADI BOGOR")); // kolom subcont terisi: harus persis
  assert.ok(!belongsTo("CV DAYA AB", "", "CV DAYA ABADI BOGOR"));
  assert.equal(displayRemark("Rusak"), "Rusak");
});

test("Kolom Photo Evidence (v5.2) terbaca terpisah dari Photo Evidence PIC; nama lain diterima", () => {
  const H = [...DO_HEADER, "PIC Name", "Photo Evidence PIC", "Photo Evidence"];
  const row = [...doRow("D9", "CV DAYA ABADI", "BOGOR", "FAT", "1", "WAIT ADMIN"), "Budi / 0812", "https://pic", "https://evidence"];
  const [line] = parseTransferSheet([H, row], "do");
  assert.equal(line!.picPhoto, "https://pic");
  assert.equal(line!.evidence, "https://evidence");
  const alias = [...DO_HEADER, "Photo Evidence DO"];
  const [l2] = parseTransferSheet([alias, [...doRow("D9", "CV DAYA ABADI", "BOGOR", "FAT", "1"), "https://ev2"]], "do");
  assert.equal(l2!.evidence, "https://ev2");
  // Kolom boleh belum ada saat membaca (sheet lama tetap tampil).
  const [l3] = parseTransferSheet([DO_HEADER, doRow("D9", "CV DAYA ABADI", "BOGOR", "FAT", "1")], "do");
  assert.equal(l3!.evidence, "");
  const [b] = parseBoqSheet([[...BOQ_HEADER, "Photo Evidence BOQ"], ["", "", "S1", "CV DAYA ABADI", "BOGOR", "", "", "", "", "FAT", "1", "", "https://ev3"]]);
  assert.equal(b!.evidence, "https://ev3");
});
