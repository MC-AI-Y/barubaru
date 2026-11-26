import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toDisplayCity } from "./city";
import { collapseSpaces, nameKey } from "./text";

describe("nameKey (pencocokan Subcont Name)", () => {
  const stored = nameKey("PT Kasih Rajawali");

  test("tidak membedakan huruf besar/kecil", () => {
    assert.equal(nameKey("pt kasih rajawali"), stored);
    assert.equal(nameKey("PT KASIH RAJAWALI"), stored);
    assert.equal(nameKey("Pt KaSiH rAjAwAlI"), stored);
  });

  test("mengabaikan spasi di awal, akhir, dan ganda", () => {
    assert.equal(nameKey("   PT Kasih Rajawali"), stored);
    assert.equal(nameKey("PT Kasih Rajawali   "), stored);
    assert.equal(nameKey("PT   Kasih    Rajawali"), stored);
    assert.equal(nameKey("\tPT Kasih Rajawali\n"), stored);
  });

  test("ejaan berbeda tetap dianggap berbeda", () => {
    assert.notEqual(nameKey("PT Kasih Rajawalli"), stored);
    assert.notEqual(nameKey("PTKasih Rajawali"), stored);
    assert.notEqual(nameKey("CV Kasih Rajawali"), stored);
  });

  test("tanda baca tetap dihitung", () => {
    assert.notEqual(nameKey("PT. Kasih Rajawali"), stored);
  });

  test("collapseSpaces merapikan spasi", () => {
    assert.equal(collapseSpaces("  a   b  "), "a b");
  });
});

describe("toDisplayCity", () => {
  test("huruf awal kapital", () => {
    assert.equal(toDisplayCity("BOGOR"), "Bogor");
    assert.equal(toDisplayCity("PADANG PARIAMAN"), "Padang Pariaman");
    assert.equal(toDisplayCity("BUKIT TINGGI"), "Bukit Tinggi");
  });

  test("singkatan tetap kapital", () => {
    assert.equal(toDisplayCity("DKI JAKARTA"), "DKI Jakarta");
    assert.equal(toDisplayCity("KAB. BOGOR"), "KAB. Bogor");
  });

  test("kata bertanda hubung dan data apa adanya", () => {
    assert.equal(toDisplayCity("TOLI-TOLI"), "Toli-Toli");
    assert.equal(toDisplayCity("KUTAIKERTANEGARA"), "Kutaikertanegara");
  });
});
