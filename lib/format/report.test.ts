import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatQuantity, formatQuantityInput, parseQuantity, validateGudang, validateMaterialFields } from "../report/validate";
import { materialCode, pdfFileName, photoFileName, subcontCode } from "./filename";
import { formatRegionList, orderByDatabase } from "./region";
import { formatDate, formatDateTime, formatTime, resolveZone, zoneFromCoordinates, zoneFromProvince } from "./time";

describe("formatRegionList", () => {
  test("1 kota", () => {
    assert.equal(formatRegionList(["BOGOR"], "display"), "Bogor");
    assert.equal(formatRegionList(["BOGOR"], "sheet"), "BOGOR");
  });
  test("2 kota tanpa koma", () => {
    assert.equal(formatRegionList(["BOGOR", "DEPOK"], "display"), "Bogor dan Depok");
    assert.equal(formatRegionList(["BOGOR", "DEPOK"], "sheet"), "BOGOR DAN DEPOK");
  });
  test("3 kota atau lebih", () => {
    assert.equal(formatRegionList(["BOGOR", "DEPOK", "CIBUBUR"], "display"), "Bogor, Depok, dan Cibubur");
    assert.equal(formatRegionList(["BOGOR", "DEPOK", "CIBUBUR"], "sheet"), "BOGOR, DEPOK, DAN CIBUBUR");
  });
  test("kota berkata ganda", () => {
    assert.equal(formatRegionList(["PADANG PARIAMAN", "BUKIT TINGGI"], "display"), "Padang Pariaman dan Bukit Tinggi");
    assert.equal(
      formatRegionList(["PADANG", "PADANG PARIAMAN", "BUKIT TINGGI"], "sheet"),
      "PADANG, PADANG PARIAMAN, DAN BUKIT TINGGI",
    );
    assert.equal(formatRegionList(["DKI JAKARTA", "BEKASI"], "display"), "DKI Jakarta dan Bekasi");
  });
  test("kosong", () => assert.equal(formatRegionList([], "display"), ""));
  test("urutan mengikuti database, bukan urutan klik", () => {
    assert.deepEqual(orderByDatabase(["DEPOK", "BOGOR"], ["BOGOR", "CIBUBUR", "DEPOK"]), ["BOGOR", "DEPOK"]);
  });
});

describe("penamaan file", () => {
  // 2026-11-03 02:43 UTC = 09:43 WIB
  const t = Date.UTC(2026, 10, 3, 2, 43, 5);
  test("subcontCode", () => {
    assert.equal(subcontCode("PT Kasih Rajawali"), "KASIHRAJAWALI");
    assert.equal(subcontCode("CV. Daya Abadi"), "DAYAABADI");
    assert.equal(subcontCode("PT KOPERASI PEGAWAI PT. INDOSAT, TBK (KOPINDOSAT)"), "KOPERASIPEGAWAIPTIND");
    assert.equal(subcontCode("PTKasih"), "PTKASIH");
  });
  test("materialCode menyaring karakter berbahaya", () => {
    assert.equal(materialCode('POLE-7M 2,5"'), "POLE-7M2-5IN");
    assert.equal(materialCode("HDPE-32/28"), "HDPE-32-28");
    assert.equal(materialCode("CABLE-48"), "CABLE-48");
    assert.equal(materialCode("../../etc/passwd"), "ETC-PASSWD");
  });
  test("format nama file", () => {
    assert.equal(photoFileName({ kind: "PAO", subcontName: "PT Kasih Rajawali", capturedAt: t, zone: "WIB" }), "20261103-0943_KASIHRAJAWALI_PAO.jpg");
    assert.equal(photoFileName({ kind: "PAC", subcontName: "PT Kasih Rajawali", capturedAt: t, zone: "WITA" }), "20261103-1043_KASIHRAJAWALI_PAC.jpg");
    assert.equal(
      photoFileName({ kind: "MATERIAL", subcontName: "PT Kasih Rajawali", capturedAt: t, zone: "WIB", material: "CABLE-48", index: 2 }),
      "20261103_KASIHRAJAWALI_CABLE-48_02.jpg",
    );
    assert.equal(pdfFileName("PT Kasih Rajawali", t, "WIB"), "20261103-0943_KASIHRAJAWALI_FORM.pdf");
  });
});

describe("zona waktu", () => {
  test("dari provinsi", () => {
    assert.equal(zoneFromProvince("Jawa Barat"), "WIB");
    assert.equal(zoneFromProvince("Daerah Khusus Ibukota Jakarta"), "WIB");
    assert.equal(zoneFromProvince("Kalimantan Barat"), "WIB");
    assert.equal(zoneFromProvince("Kalimantan Timur"), "WITA");
    assert.equal(zoneFromProvince("Sulawesi Selatan"), "WITA");
    assert.equal(zoneFromProvince("Bali"), "WITA");
    assert.equal(zoneFromProvince("Gorontalo"), "WITA");
    assert.equal(zoneFromProvince("Maluku Utara"), "WIT");
    assert.equal(zoneFromProvince("Papua Barat Daya"), "WIT");
    assert.equal(zoneFromProvince("Kanagawa"), null);
  });
  test("dari koordinat (cadangan)", () => {
    assert.equal(zoneFromCoordinates(-6.2, 106.8), "WIB"); // Jakarta
    assert.equal(zoneFromCoordinates(3.59, 98.67), "WIB"); // Medan
    assert.equal(zoneFromCoordinates(-8.65, 115.2), "WITA"); // Denpasar
    assert.equal(zoneFromCoordinates(-5.14, 119.43), "WITA"); // Makassar
    assert.equal(zoneFromCoordinates(-2.53, 140.7), "WIT"); // Jayapura
    assert.equal(zoneFromCoordinates(35.6, 139.7), null); // Tokyo
  });
  test("resolveZone: provinsi > koordinat > perangkat", () => {
    assert.equal(resolveZone({ province: "Kalimantan Timur", lat: -1.2, lon: 114.9 }), "WITA");
    assert.equal(resolveZone({ lat: 35.6, lon: 139.7, deviceOffsetMinutes: 540 }), "WIT");
    assert.equal(resolveZone({ lat: 35.6, lon: 139.7, deviceOffsetMinutes: 60 }), "WIB");
  });
  test("format", () => {
    const t = Date.UTC(2026, 10, 3, 17, 5, 9); // 4 Nov 00:05:09 WIB
    assert.equal(formatDate(t, "WIB"), "04/11/2026");
    assert.equal(formatTime(t, "WIB"), "00:05:09 WIB");
    assert.equal(formatDateTime(t, "WIT"), "04/11/2026 02:05:09 WIT");
  });
});

describe("validasi", () => {
  test("parseQuantity: angka bulat saja, tanpa pemisah", () => {
    assert.equal(parseQuantity("1200"), 1200);
    assert.equal(parseQuantity(" 10 "), 10);
    assert.equal(parseQuantity(1200), 1200);
    for (const bad of ["0", "-1", "abc", "12,5", "12.5", "1.200", "1,200", "1 200", "", "1e3"]) assert.equal(parseQuantity(bad), null, bad);
    assert.equal(parseQuantity(12.5), null);
    assert.equal(formatQuantity(1200), "1200");
    assert.equal(formatQuantity(1250000), "1250000");
    assert.equal(formatQuantityInput("1200"), "1200");
    assert.equal(formatQuantityInput("1.200"), "1200");
    assert.equal(formatQuantityInput("12,5"), "125");
    assert.equal(formatQuantityInput("007"), "7");
    assert.equal(formatQuantityInput("abc"), "");
  });
  test("validateGudang", () => {
    const ok = { regions: ["BOGOR"], warehouseName: "WH A", pic: "Budi", spv: "Sari", pm: "Andi" };
    assert.deepEqual(validateGudang(ok, ["BOGOR"]), {});
    const bad = validateGudang({ regions: [], warehouseName: " ", pic: "", spv: "x", pm: "y" });
    assert.ok(bad.regions && bad.warehouseName && bad.pic && !bad.spv);
    assert.ok(validateGudang({ ...ok, regions: ["MEDAN"] }, ["BOGOR"]).regions);
    assert.match(validateGudang({ ...ok, regions: ["BOGOR", "DEPOK"] }, ["BOGOR", "DEPOK"]).regions ?? "", /satu kota/);
  });
  test("validateMaterialFields", () => {
    const options = [{ name: "FDT-48", remarks: ["-"], unit: "Pcs" }, { name: "CABLE-48", remarks: ["Old (Hitam)"], unit: "M" }];
    assert.deepEqual(validateMaterialFields({ material: "FDT-48", remark: "-", quantity: "2", unit: "Pcs", notes: "" }, options), {});
    const e = validateMaterialFields({ material: "CABLE-48", remark: "Baru", quantity: "0", unit: "", notes: "" }, options);
    assert.ok(e.remark && e.quantity && e.unit);
  });
  test("satuan otomatis wajib sama dengan master", () => {
    const options = [{ name: "CABLE-48", remarks: ["Old (Hitam)"], unit: "M" }, { name: "FDT-48", remarks: ["-"], unit: "Pcs" }];
    const base = { material: "CABLE-48", remark: "Old (Hitam)", quantity: "1200", notes: "" };
    assert.deepEqual(validateMaterialFields({ ...base, unit: "M" }, options), {});
    assert.match(validateMaterialFields({ ...base, unit: "meter" }, options).unit ?? "", /harus "M"/);
    assert.match(validateMaterialFields({ material: "FDT-48", remark: "-", quantity: "1", unit: "Unit", notes: "" }, options).unit ?? "", /harus "Pcs"/);
  });
});
