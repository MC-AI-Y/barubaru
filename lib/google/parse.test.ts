import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { unitFor, findColumns, forwardFill, NO_REMARK, parseMaterials, parseRegions, parseUsers, SheetFormatError } from "./parse";

describe("forwardFill", () => {
  test("mengisi sel kosong dengan nilai terakhir di atasnya (sel gabungan)", () => {
    const rows = [
      ["PT A", "BOGOR"],
      ["", "DEPOK"],
      ["", "CIBUBUR"],
      ["CV B", "MEDAN"],
      ["", "LANGKAT"],
    ];
    assert.deepEqual(
      forwardFill(rows, 0).map((r) => r[0]),
      ["PT A", "PT A", "PT A", "CV B", "CV B"],
    );
  });

  test("baris pendek (Google tidak mengirim sel kosong) tetap terisi", () => {
    const rows = [["CABLE-48", "Old (Hitam)"], [undefined as unknown as string, "New (Garis Ungu)"], []];
    const filled = forwardFill(rows as string[][], 0);
    assert.equal(filled[1]?.[0], "CABLE-48");
  });

  test("baris kosong total dibiarkan kosong tanpa memutus pewarisan", () => {
    const rows = [["PT A", "BOGOR"], [], ["", "DEPOK"]];
    const filled = forwardFill(rows, 0);
    assert.deepEqual(filled[1], []);
    assert.equal(filled[2]?.[0], "PT A");
  });

  test("sel berisi spasi saja dianggap kosong", () => {
    const filled = forwardFill([["PT A", "X"], ["   ", "Y"]], 0);
    assert.equal(filled[1]?.[0], "PT A");
  });

  test("tidak mengubah array asli", () => {
    const rows = [["PT A", "X"], ["", "Y"]];
    forwardFill(rows, 0);
    assert.equal(rows[1]?.[0], "");
  });
});

describe("findColumns", () => {
  test("mencocokkan header tanpa peka huruf besar/kecil dan spasi", () => {
    const cols = findColumns(["  subcont   name ", "PASSWORD"], ["Subcont Name", "Password"], "uji");
    assert.deepEqual(cols, { "Subcont Name": 0, Password: 1 });
  });

  test("galat jelas bila kolom tidak ada", () => {
    assert.throws(() => findColumns(["Nama", "Sandi"], ["Subcont Name"], "uji"), SheetFormatError);
  });
});

describe("parseUsers (dedupe)", () => {
  const header = ["Subcont Name", "Password"];

  test("baris ganda identik diabaikan, akun tetap bisa dipakai", () => {
    const dir = parseUsers([
      header,
      ["PT Grha Prima Agung", "Grha1234"],
      ["CV Increase Development", "Incr5678"],
      ["PT Grha Prima Agung", "Grha1234"],
      ["pt  grha prima agung ", "Grha1234"],
    ]);
    assert.equal(dir.users.size, 2);
    assert.equal(dir.duplicatesIgnored, 2);
    assert.equal(dir.conflicts.size, 0);
    assert.equal(dir.users.get("pt grha prima agung")?.password, "Grha1234");
  });

  test("nama sama dengan password berbeda ditandai konflik dan dihapus", () => {
    const dir = parseUsers([header, ["PT X", "aaa"], ["PT X", "bbb"], ["PT Y", "ccc"]]);
    assert.equal(dir.users.has("pt x"), false);
    assert.equal(dir.conflicts.has("pt x"), true);
    assert.equal(dir.users.size, 1);
  });

  test("baris tanpa nama atau password dilewati", () => {
    const dir = parseUsers([header, ["", "abc"], ["PT Z"], ["PT Z2", ""]]);
    assert.equal(dir.users.size, 0);
  });

  test("password disimpan apa adanya (tidak di-trim)", () => {
    const dir = parseUsers([header, ["PT P", " Daya4385 "]]);
    assert.equal(dir.users.get("pt p")?.password, " Daya4385 ");
  });

  test("spasi berlebih di nama database dirapikan untuk tampilan", () => {
    const dir = parseUsers([header, ["  PT   Kasih  Rajawali ", "x"]]);
    assert.equal(dir.users.get("pt kasih rajawali")?.name, "PT Kasih Rajawali");
  });
});

describe("parseRegions", () => {
  test("forward-fill subcont lalu kelompokkan kota sesuai urutan database", () => {
    const map = parseRegions([
      ["Subcont Name", "City"],
      ["PT A", "BOGOR"],
      ["", "DEPOK"],
      ["", "BOGOR"],
      ["CV B", "PADANG PARIAMAN"],
      ["", ""],
      ["", "KUTAIKERTANEGARA"],
    ]);
    assert.deepEqual(map.get("pt a"), ["BOGOR", "DEPOK"]);
    assert.deepEqual(map.get("cv b"), ["PADANG PARIAMAN", "KUTAIKERTANEGARA"]);
  });

  test("kolom boleh tertukar urutannya", () => {
    const map = parseRegions([["City", "Subcont Name"], ["MEDAN", "PT M"], ["LANGKAT"]]);
    assert.deepEqual(map.get("pt m"), ["MEDAN", "LANGKAT"]);
  });
});

describe("parseMaterials", () => {
  const values = [
    ["Material", "Remark"],
    ['POLE-7M 2,5"', "USPl"],
    ["", "Vendor B"],
    ["CABLE-48", "Old (Hitam)"],
    ["", "New (Garis Ungu)"],
    ["FDT-48", ""],
    ["HDPE-32/28"],
    ["CLOSURE-24", "Inline"],
    ["", "Dome"],
    ["", "Dome"],
  ];

  test("forward-fill material dan pasangkan remark", () => {
    const list = parseMaterials(values);
    assert.deepEqual(
      list.map((m) => m.name),
      ['POLE-7M 2,5"', "CABLE-48", "FDT-48", "HDPE-32/28", "CLOSURE-24"],
    );
    assert.deepEqual(list[1]?.remarks, ["Old (Hitam)", "New (Garis Ungu)"]);
  });

  test('material tanpa remark mengembalikan "-"', () => {
    const list = parseMaterials(values);
    assert.deepEqual(list.find((m) => m.name === "FDT-48")?.remarks, [NO_REMARK]);
    assert.deepEqual(list.find((m) => m.name === "HDPE-32/28")?.remarks, [NO_REMARK]);
  });

  test("satuan otomatis: kabel/HDPE = M, selain itu = Pcs", () => {
    const list = parseMaterials(values);
    assert.deepEqual(
      list.map((m) => [m.name, m.unit]),
      list.map((m) => [m.name, /CABLE|HDPE/i.test(m.name) ? "M" : "Pcs"]),
    );
    assert.ok(list.some((m) => m.unit === "M") && list.some((m) => m.unit === "Pcs"));
    assert.equal(unitFor("CABLE-48"), "M");
    assert.equal(unitFor("cable-24 adss"), "M");
    assert.equal(unitFor("DROP CABLE 1 CORE"), "M");
    assert.equal(unitFor("Kabel Duct 96"), "M");
    assert.equal(unitFor("HDPE-32/28"), "M");
    assert.equal(unitFor("hdpe-40/34"), "M");
    assert.equal(unitFor('POLE-7M 2,5"'), "Pcs");
    assert.equal(unitFor("FDT-48"), "Pcs");
    assert.equal(unitFor("CLOSURE 24"), "Pcs");
  });

  test("kolom Satuan di sheet tidak dipakai lagi (satuan selalu dari aturan)", () => {
    const list = parseMaterials([
      ["Material", "Remark", "Satuan"],
      ["CABLE-48", "Old (Hitam)", "Roll"],
      ["FDT-48", "", "Unit"],
    ]);
    assert.deepEqual(list.map((m) => [m.name, m.unit]), [["CABLE-48", "M"], ["FDT-48", "Pcs"]]);
  });

  test("typo data tidak diperbaiki dan remark ganda tidak diulang", () => {
    const list = parseMaterials(values);
    assert.deepEqual(list[0]?.remarks, ["USPl", "Vendor B"]);
    assert.deepEqual(list[4]?.remarks, ["Inline", "Dome"]);
  });
});

import { test as tAlias } from "node:test";
import assertAlias from "node:assert/strict";
import { parseRegions as parseRegionsAlias, parseUsers as parseUsersAlias, headerNameMatches } from "./parse";

tAlias("Phase 2: judul kolom \"Subcont\" diterima sebagai \"Subcont Name\"", () => {
  const users = parseUsersAlias([
    ["Subcont", "Password"],
    ["PT Kasih Rajawali", "Rahasia1"],
  ]);
  assertAlias.equal(users.users.size, 1);
  const regions = parseRegionsAlias([
    ["Subcont", "City", "Subcont City", "Region"],
    ["PT Kasih Rajawali", "BOGOR", "PT Kasih Rajawali BOGOR", "JABAR"],
    ["", "DEPOK", "PT Kasih Rajawali DEPOK", "JABAR"],
  ]);
  assertAlias.deepEqual([...regions.values()][0], ["BOGOR", "DEPOK"]);
  assertAlias.ok(headerNameMatches("Subcont", "Subcont Name"));
  assertAlias.ok(headerNameMatches(" subcont name ", "Subcont Name"));
  assertAlias.ok(!headerNameMatches("Subcont City", "Subcont Name"));
});
