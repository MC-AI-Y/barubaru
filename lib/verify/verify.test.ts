import { test } from "node:test";
import assert from "node:assert/strict";
import { indexByKey, parseRecords, recordToRow, VERIFY_HEADER, type VerificationRecord } from "./records";
import { buildDocuments, listDocuments } from "../orders/access";
import { parseTransferSheet } from "../orders/parse";
import { verifyPhotoFileName } from "../format/filename";

const base: Omit<VerificationRecord, "row" | "kind"> = {
  id: "11111111-2222-4333-8444-555555555555",
  key: "do-001",
  number: "DO-001",
  siteName: "",
  subcont: "CV DAYA ABADI",
  subcontCity: "CV DAYA ABADI BOGOR",
  status: "Menunggu Admin",
  submittedAt: 1_790_000_000_000,
  submittedText: "23/11/2026 16:30 WIB",
  submittedBy: "CV DAYA ABADI",
  location: "Cibinong, Bogor",
  photoFileId: "FILE123",
  photoName: "x.jpg",
  notes: "aman",
  materialCount: 2,
  totalQty: 102,
  reviewedAt: 0,
  reviewedText: "",
  reviewedBy: "",
  rejectReason: "",
  picName: "Budi",
  picPhone: "081234567890",
  picPhotoFileId: "PICFILE1",
};

test("recordToRow ↔ parseRecords bolak-balik", () => {
  const row = recordToRow(base).map(String);
  assert.equal(row.length, VERIFY_HEADER.length);
  const [r] = parseRecords([[...VERIFY_HEADER], row], "do");
  assert.equal(r!.row, 2);
  assert.equal(r!.status, "Menunggu Admin");
  assert.equal(r!.submittedAt, base.submittedAt);
  assert.equal(r!.totalQty, 102);
  assert.match(row[20]!, /drive\.google\.com\/file\/d\/FILE123/);
  assert.equal(r!.picPhotoFileId, "PICFILE1");
  assert.match(row[VERIFY_HEADER.indexOf("PIC Photo Link")]!, /drive\.google\.com\/file\/d\/PICFILE1/);
  assert.equal(parseRecords([[...VERIFY_HEADER], ["", "k", "", "", "", "", "Menunggu Admin"]], "do").length, 0);
  assert.equal(parseRecords([[...VERIFY_HEADER], ["id", "k", "", "", "", "", "Aneh"]], "do").length, 0);
});

const HEADER = ["DO NUMBER", "WH/SUPPLIER DESTINATION", "WH NAME/SUPPLIER CITY DESTINATION", "MATERIAL NAME", "QTY", "Verified"];
const mk = (v1: string, v2 = "") =>
  parseTransferSheet(
    [HEADER, ["DO-001", "CV DAYA ABADI", "CV DAYA ABADI BOGOR", "CABLE-48", "100", v1], ["DO-002", "CV DAYA ABADI", "CV DAYA ABADI BOGOR", "FDT-48", "2", v2]],
    "do",
  );
const lines = mk("");
const sub = { subcontName: "CV DAYA ABADI", role: "subcont" as const };
const admin = { subcontName: "admin", role: "admin" as const };
const rec = (status: VerificationRecord["status"], id = base.id, extra: Partial<VerificationRecord> = {}): VerificationRecord => ({ ...base, row: 2, kind: "do", status, id, ...extra });

test("RECEIVED di sheet: hilang dari Perlu verifikasi subcont, masuk antrean admin", () => {
  const pending = mk("RECEIVED");
  const history = indexByKey([rec("Menunggu Admin")]);
  const s = buildDocuments("do", { transfer: pending }, sub, history).get("do-001")!.summary;
  assert.deepEqual([s.status, s.statusLabel, s.needsAction], ["pending", "RECEIVED", false]);
  const subList = listDocuments(buildDocuments("do", { transfer: pending }, sub, history), { view: "todo", q: "", subcont: "", page: 1, pageSize: 20 });
  assert.deepEqual(subList.items.map((x) => x.number), ["DO-002"]);
  assert.equal(subList.kpi.waiting, 1);
  const adminList = listDocuments(buildDocuments("do", { transfer: pending }, admin, history), { view: "todo", q: "", subcont: "", page: 1, pageSize: 20 });
  assert.deepEqual(adminList.items.map((x) => x.number), ["DO-001"]);
  assert.equal(adminList.subconts[0]!.action, 1);
});

test("Status hanya dari sheet: catatan Verifikasi tidak mengubah status, hanya riwayat", () => {
  const history = indexByKey([rec("Menunggu Admin"), rec("Ditolak", "22222222-2222-4333-8444-555555555555", { rejectReason: "Foto buram" })]);
  const blank = buildDocuments("do", { transfer: lines }, sub, history).get("do-001")!;
  assert.deepEqual([blank.summary.status, blank.summary.statusLabel], ["open", ""]);
  assert.equal(blank.history.length, 2);
  assert.equal(blank.history[0]!.status, "Ditolak"); // terbaru dulu
  assert.equal(blank.history[0]!.picName, "Budi");
  const rejected = buildDocuments("do", { transfer: mk("NEED CHECK") }, sub, history).get("do-001")!.summary;
  assert.deepEqual([rejected.status, rejected.statusLabel, rejected.needsAction], ["rejected", "NEED CHECK", true]);
  assert.equal(rejected.latest!.rejectReason, "Foto buram");
  const ok = buildDocuments("do", { transfer: mk("APPROVED") }, sub, history).get("do-001")!.summary;
  assert.equal(ok.status, "verified");
});

test("Nama file foto verifikasi sesuai spesifikasi", () => {
  const t = Date.UTC(2026, 10, 24, 2, 15); // 09:15 WIB
  assert.equal(verifyPhotoFileName({ kind: "do", number: "DO2411001", subcontName: "CV Daya Abadi", capturedAt: t, zone: "WIB" }), "20261124-0915_DO-DO2411001_DAYAABADI.jpg");
  assert.equal(
    verifyPhotoFileName({ kind: "boq", number: "Cibinong 01", siteName: "Cibinong 01", subcontName: "CV Daya Abadi", capturedAt: t, zone: "WIB" }),
    "20261124-0915_BOQ-CIBINONG-01_DAYAABADI.jpg",
  );
  assert.equal(verifyPhotoFileName({ kind: "to", number: "TO/24/11 015", subcontName: "PT Bahtera", capturedAt: t, zone: "WIB" }), "20261124-0915_TO-TO-24-11-015_BAHTERA.jpg");
});

import { columnLetter } from "../orders/write";
import { normalizePhone, picCell } from "./pic";
import { approvedValue, documentState, needsAdminDecision, normalizeBoqChoice, rowState } from "../orders/status";

test("PIC: nomor telepon dan isi kolom PIC Name", () => {
  assert.equal(normalizePhone("0812-3456 7890"), "081234567890");
  assert.equal(normalizePhone("+62 812 3456 7890"), "+6281234567890");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("08abc"), null);
  assert.equal(picCell("Budi", "0812"), "Budi (0812)");
});

test("Nilai status per jenis dokumen", () => {
  for (const v of ["APD", "abd", "RFSC", "FO CUT/VANDALISME", "fo cut / vandalisme"]) assert.equal(rowState("boq", v), "approved", v);
  assert.equal(rowState("boq", "need check"), "other");
  assert.equal(normalizeBoqChoice("fo cut / vandalisme"), "FO CUT/VANDALISME");
  assert.equal(normalizeBoqChoice("BOQ Opname"), null);
  assert.equal(rowState("to", "ON DELIVERY"), "other"); // ON DELIVERY hanya untuk DO
  assert.equal(rowState("do", "on delivery"), "open");
  assert.equal(rowState("to", "RECEIVED"), "pending");
  assert.equal(rowState("to", "APPROVED"), "approved");
  assert.equal(rowState("to", "NEED CHECK"), "rejected");
  assert.equal(rowState("do", "TRUE"), "approved");
  assert.deepEqual(documentState("do", ["APPROVED", ""]), { state: "open", label: "", partial: true });
  assert.deepEqual(documentState("do", ["APPROVED", "RECEIVED"]), { state: "pending", label: "RECEIVED", partial: true });
  assert.deepEqual(documentState("do", ["ON DELIVERY", ""]), { state: "open", label: "ON DELIVERY", partial: false });
  assert.equal(needsAdminDecision("boq"), false);
  assert.equal(approvedValue("to"), "APPROVED");
});

test("columnLetter", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(10), "K");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(columnLetter(51), "AZ");
});

import { wibDayStart } from "../orders/access";

test("Filter tanggal kirim (WIB) untuk riwayat admin", () => {
  assert.equal(wibDayStart("2026-11-24"), Date.UTC(2026, 10, 23, 17, 0));
  assert.equal(wibDayStart("24/11/2026"), null);
  const history = indexByKey([rec("Menunggu Admin")]); // submittedAt = base.submittedAt
  const docs = buildDocuments("do", { transfer: lines }, admin, history);
  const day = new Date(base.submittedAt + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const from = wibDayStart(day)!;
  const q = { view: "all" as const, q: "", subcont: "", page: 1, pageSize: 20 };
  assert.deepEqual(listDocuments(docs, { ...q, from, to: from + 86_400_000 }).items.map((s) => s.number), ["DO-001"]);
  assert.equal(listDocuments(docs, { ...q, from: from + 86_400_000 }).total, 0);
});

import { documentWatermarkLines } from "../../components/camera/watermark";

test("Watermark dokumen: format Visit, semua material (maks 8) + ringkasan sisa", () => {
  const capture = { t: Date.UTC(2026, 10, 26, 3, 0), zone: "WIB", lat: -6.5, lon: 106.8, source: "nominatim", short: "Cibinong", location: "Cibinong, Bogor" } as never;
  const items = Array.from({ length: 10 }, (_, i) => ({ material: `CABLE-${i}`, qty: 1200, unit: "M" }));
  const lines = documentWatermarkLines({ capture, subcontName: "CV A", warehouseName: "CV A BOGOR", items });
  assert.equal(lines[0], "26/11/2026 10:00:00 WIB");
  assert.equal(lines[1], "Cibinong (-6.50000, 106.80000)");
  assert.deepEqual(lines.slice(2, 4), ["CV A", "CV A BOGOR"]);
  assert.equal(lines[4], "CABLE-0 · Remark: - · 1200 M");
  assert.equal(lines.length, 4 + 8 + 1);
  assert.equal(lines.at(-1), "+2 material lainnya");
});
