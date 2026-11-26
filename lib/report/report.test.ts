import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, test } from "node:test";
import type { CellValue } from "../google/sheets";
import { createCaptureContext } from "./capture";
import { finalizeReport, parseSubmitPayload, ResultSheetHeaderError, SubmitValidationError, type FinalizeDeps } from "./finalize";
import { RESULT_HEADERS } from "./rows";
import { signUpload, verifyCapture } from "./signature";
import type { CaptureContext, SubmitPayload, SubmitPhoto } from "./types";

const SECRET = "uji-rahasia-yang-panjangnya-lebih-dari-32-karakter";
const SUB = "PT Kasih Rajawali";
const T0 = Date.UTC(2026, 10, 3, 2, 43, 0);

const geoOk = async () => ({ location: "Jl. Raya Bogor, Cibinong, Kabupaten Bogor, Jawa Barat", short: "Jl. Raya Bogor, Cibinong", province: "Jawa Barat" });

async function capture(lat = -6.48, lon = 106.85, t = T0): Promise<CaptureContext> {
  const r = await createCaptureContext({ lat, lon, acc: 8, tzOffset: 420 }, { subcont: SUB, secret: SECRET, now: () => t, geocode: geoOk });
  return r.context;
}

describe("createCaptureContext", () => {
  test("lapis 1 berhasil: waktu server, zona dari provinsi, ditandatangani", async () => {
    const c = await capture();
    assert.equal(c.t, T0);
    assert.equal(c.zone, "WIB");
    assert.equal(c.source, "nominatim");
    assert.ok(verifyCapture(c, SUB, SECRET));
    assert.equal(verifyCapture({ ...c, t: c.t - 3600_000 }, SUB, SECRET), false, "waktu diubah harus ditolak");
    assert.equal(verifyCapture(c, "PT Lain", SECRET), false, "akun lain harus ditolak");
  });

  test("cache perangkat: foto ≤ 75 m memakai alamat sebelumnya tanpa memanggil geocode", async () => {
    const prev = await capture();
    let called = 0;
    const r = await createCaptureContext(
      { lat: -6.4803, lon: 106.8502, acc: 5, tzOffset: 420, reuse: prev },
      { subcont: SUB, secret: SECRET, now: () => T0 + 60_000, geocode: async () => (called++, null) },
    );
    assert.equal(called, 0);
    assert.equal(r.context.location, prev.location);
    assert.equal(r.context.t, T0 + 60_000);
  });

  test("semua lapis server gagal: koordinat + tiket; tiket bisa dipakai untuk lapis 2 dengan waktu yang sama", async () => {
    const first = await createCaptureContext(
      { lat: -5.14, lon: 119.43, acc: 20, tzOffset: 480 },
      { subcont: SUB, secret: SECRET, now: () => T0, geocode: async () => null },
    );
    assert.equal(first.context.source, "coordinates");
    assert.equal(first.context.location, "-5.14000, 119.43000");
    assert.equal(first.context.zone, "WITA");
    assert.ok(first.ticket);

    const second = await createCaptureContext(
      { lat: 0, lon: 0, acc: 0, tzOffset: 480, fallback: { ticket: first.ticket!, location: "Makassar, Sulawesi Selatan", short: "Makassar", province: "Sulawesi Selatan" } },
      { subcont: SUB, secret: SECRET, now: () => T0 + 3000, geocode: async () => null },
    );
    assert.equal(second.context.source, "bigdatacloud");
    assert.equal(second.context.t, T0, "waktu tetap dari tiket server");
    assert.equal(second.context.lat, -5.14, "koordinat tetap dari tiket, bukan dari permintaan kedua");
  });
});

// ── finalize ───────────────────────────────────────────────

function photo(c: CaptureContext, sid: string, kind: string): SubmitPhoto {
  const photoId = randomUUID();
  const fileId = `file-${photoId.slice(0, 8)}`;
  return {
    photoId,
    capture: c,
    upload: { fileId, link: `https://drive.google.com/file/d/${fileId}/view`, receipt: signUpload({ submissionId: sid, kind, photoId, fileId }, SUB, SECRET) },
  };
}

async function samplePayload(n = 3): Promise<SubmitPayload> {
  const sid = randomUUID();
  const mats = ["CABLE-48", "FDT-48", 'POLE-7M 2,5"'];
  const materials = [];
  for (let i = 0; i < n; i++) {
    const c = await capture(-6.48 + i * 0.01, 106.85, T0 + i * 60_000);
    const material = mats[i % 3]!;
    materials.push({
      material,
      remark: material === "CABLE-48" ? "Old (Hitam)" : material === "FDT-48" ? "-" : "USPl",
      quantity: (i + 1) * 1200,
      unit: material === "CABLE-48" ? "M" : "Pcs",
      notes: i === 0 ? "=HYPERLINK(\"x\")" : "",
      photo: photo(c, sid, "MATERIAL"),
    });
  }
  return {
    submissionId: sid,
    gudang: { regions: ["BOGOR"], warehouseName: "Gudang Utama", pic: "Budi", spv: "Sari", pm: "Andi" },
    pao: photo(await capture(), sid, "PAO"),
    pac: photo(await capture(-6.48, 106.85, T0 + 10 * 60_000), sid, "PAC"),
    materials,
  };
}

function fakeSheet() {
  const rows: CellValue[][] = [[...RESULT_HEADERS]];
  let pdfUploads = 0;
  let appends = 0;
  const pdfs = new Map<string, { fileId: string; link: string }>();
  const deps: FinalizeDeps = {
    secret: SECRET,
    now: () => T0 + 15 * 60_000,
    getAccountCities: async () => ["BOGOR", "CIBUBUR", "DEPOK"],
    getMaterials: async () => [
      { name: "CABLE-48", remarks: ["Old (Hitam)", "New (Garis Ungu)"], unit: "M" },
      { name: "FDT-48", remarks: ["-"], unit: "Pcs" },
      { name: 'POLE-7M 2,5"', remarks: ["USPl"], unit: "Pcs" },
    ],
    readHeader: async () => rows[0]!.map(String),
    readIdAndPdfColumns: async () => ({ ids: rows.map((r) => String(r[0])), pdfLinks: rows.map((r) => String(r[18] ?? "")) }),
    findExistingPdf: async (sid) => pdfs.get(sid) ?? null,
    renderPdf: async () => new Uint8Array([37, 80, 68, 70]),
    uploadPdf: async ({ submissionId }) => {
      pdfUploads++;
      const v = { fileId: `pdf-${submissionId.slice(0, 6)}`, link: `https://drive.google.com/file/d/pdf-${submissionId.slice(0, 6)}/view` };
      pdfs.set(submissionId, v);
      return v;
    },
    appendRows: async (r) => {
      appends++;
      rows.push(...r);
    },
  };
  return { deps, rows, counts: () => ({ pdfUploads, appends }) };
}

describe("finalizeReport", () => {
  test("3 material → 3 baris 20 kolom dalam satu operasi, sesuai skema", async () => {
    const { deps, rows, counts } = fakeSheet();
    const payload = await samplePayload(3);
    const res = await finalizeReport(payload, SUB, deps);
    assert.equal(res.rows, 3);
    assert.equal(rows.length, 4);
    assert.deepEqual(counts(), { pdfUploads: 1, appends: 1 });
    const r1 = rows[1]!;
    assert.equal(r1.length, 21);
    assert.equal(r1[0], payload.submissionId);
    assert.equal(r1[1], SUB);
    assert.equal(r1[2], payload.pao.upload.link);
    assert.equal(r1[3], "03/11/2026");
    assert.equal(r1[4], "09:43:00 WIB");
    assert.equal(r1[6], "BOGOR", "Region kapital");
    assert.match(String(r1[20]), / BOGOR$/, "kolom U = Subcont City");
    assert.equal(r1[13], 1200);
    assert.equal(r1[14], "M");
    assert.equal(r1[16], '=HYPERLINK("x")', "teks disimpan apa adanya (ditulis RAW, tidak dieksekusi)");
    assert.equal(r1[18], res.pdfLink);
    assert.equal(r1[19], "03/11/2026 09:58:00 WIB");
    assert.equal(rows[2]![4], "09:44:00 WIB", "waktu per baris mengikuti foto masing-masing");
    assert.equal(rows[2]![12], "-");
  });

  test("kirim ulang tidak menggandakan baris", async () => {
    const { deps, rows, counts } = fakeSheet();
    const payload = await samplePayload(3);
    await finalizeReport(payload, SUB, deps);
    const again = await finalizeReport(structuredClone(payload), SUB, deps);
    assert.equal(again.duplicate, true);
    assert.equal(rows.length, 4);
    assert.deepEqual(counts(), { pdfUploads: 1, appends: 1 });
  });

  test("dua permintaan bersamaan hanya menulis sekali", async () => {
    const { deps, rows } = fakeSheet();
    const payload = await samplePayload(2);
    await Promise.all([finalizeReport(payload, SUB, deps), finalizeReport(payload, SUB, deps)]);
    assert.equal(rows.length, 3);
  });

  test("header spreadsheet tidak sesuai → ditolak tanpa menulis", async () => {
    const { deps, rows } = fakeSheet();
    rows[0] = ["Photo Authorized Open", "Date"];
    await assert.rejects(finalizeReport(await samplePayload(1), SUB, deps), ResultSheetHeaderError);
    assert.equal(rows.length, 1);
  });

  test("validasi server: kota di luar akun, remark salah, foto dimanipulasi", async () => {
    const { deps } = fakeSheet();
    const p1 = await samplePayload(1);
    p1.gudang.regions = ["MEDAN"];
    await assert.rejects(finalizeReport(p1, SUB, deps), SubmitValidationError);

    const p2 = await samplePayload(1);
    p2.materials[0]!.remark = "Remark Palsu";
    await assert.rejects(finalizeReport(p2, SUB, deps), SubmitValidationError);

    const p3 = await samplePayload(1);
    p3.materials[0]!.photo.capture = { ...p3.materials[0]!.photo.capture, location: "Alamat lain" };
    await assert.rejects(finalizeReport(p3, SUB, deps), /tidak sah/);

    const p4 = await samplePayload(1);
    await assert.rejects(finalizeReport(p4, "PT Lain", deps), SubmitValidationError);
  });

  test("parseSubmitPayload menolak bentuk yang salah", () => {
    assert.throws(() => parseSubmitPayload({ submissionId: "bukan-uuid", materials: [{}] }), SubmitValidationError);
    assert.throws(() => parseSubmitPayload({ submissionId: randomUUID(), materials: [] }), /Minimal 1 material/);
  });
});
