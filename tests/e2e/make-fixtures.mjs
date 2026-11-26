/**
 * Membuat data uji FIKTIF untuk uji e2e (tanpa data asli YOFC/subcont).
 * Jalankan ulang bila ingin data baru: node tests/e2e/make-fixtures.mjs
 * Hasil: fixtures/region.json (Subcont and City Area) dan fixtures/orders.json (DO, TO, BOQ).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];
const sample = (a, n) => [...a].sort(() => rand() - 0.5).slice(0, n);

const CITIES = ["BOGOR", "DEPOK", "BEKASI", "JAKARTA", "TANGERANG", "BANDUNG", "CIREBON", "GARUT", "SEMARANG", "SOLO", "SALATIGA", "SURABAYA", "MALANG", "SIDOARJO", "KEDIRI", "MEDAN", "PALEMBANG", "PADANG", "PEKANBARU", "MAKASSAR", "MANADO", "GORONTALO", "PALU", "KENDARI", "BALI", "MATARAM", "SAMARINDA", "BALIKPAPAN", "PONTIANAK", "BANJARMASIN"];

// Akun uji yang dipakai skrip (nama fiktif).
const FIXED = [
  ["CV UJI SATU", ["BOGOR"]],
  ["CV UJI KREASI NUSANTARA", ["GORONTALO", "KOTAMOBAGU", "MANADO", "PALU", "KENDARI", "MAKASSAR"]],
  ["PT UJI BAHARI KONSTRUKSI", sample(CITIES, 22)],
  ["PT KOPERASI PEGAWAI PT. UJI TELEKOM, TBK (KOPUJITEL)", sample(CITIES, 13)],
];
const subconts = [...FIXED];
for (let i = 1; i <= 40; i++) subconts.push([`PT SUBCONT UJI ${String(i).padStart(3, "0")}`, sample(CITIES, 1 + Math.floor(rand() * 5))]);

// Sel digabung: nama subcont hanya di baris pertama kelompoknya (meniru sheet asli).
const regionRows = [["Subcont Name", "City"]];
for (const [name, cities] of subconts) cities.forEach((c, i) => regionRows.push([i === 0 ? name : "", c]));

const REGION_OF = (city) =>
  ({ GORONTALO: "Sulawesi", MANADO: "Sulawesi", PALU: "Sulawesi", KENDARI: "Sulawesi", MAKASSAR: "Sulawesi", KOTAMOBAGU: "Sulawesi", BOGOR: "Jawa Barat", DEPOK: "Jawa Barat", BANDUNG: "Jawa Barat", MEDAN: "Sumatera Utara" })[city] ?? pick(["Jawa Timur", "Jawa Tengah", "Kalimantan Timur", "Bali"]);
const regionCache = new Map();
const regionFor = (city) => (regionCache.has(city) ? regionCache.get(city) : (regionCache.set(city, REGION_OF(city)), regionCache.get(city)));
// Status v5.3. DO: ON DELIVERY / RECEIVED / APPROVED / NEED CHECK; TO: RECEIVED / APPROVED / NEED CHECK.
const doStatus = (kind = "do") => {
  const r = rand();
  if (r < 0.42) return "APPROVED";
  if (r < 0.5) return "RECEIVED";
  if (r < 0.53) return "NEED CHECK";
  if (kind === "do" && r < 0.68) return "ON DELIVERY";
  return "";
};
const MATS = ["CABLE-48", "CABLE-24", "FDT-48", 'POLE-7M 2,5"', "HDPE-32/28", "CLOSURE-24", "FAT", "FDT-96"];
const H = ["PIC Name", "Photo Evidence PIC", "DO NUMBER", "WH/SUPPLIER ORIGIN", "CITY/SUPPLIER NAME ORIGIN", "WH NAME/SUPPLIER CITY ORIGIN", "WH/SUPPLIER DESTINATION", "CITY/SUPPLIER NAME DESTINATION", "WH NAME/SUPPLIER CITY DESTINATION", "REGION", "MATERIAL NAME", "QTY", "Verified", "Photo Evidence"];
const main = "CV UJI KREASI NUSANTARA";
const dests = [[main, "GORONTALO"], [main, "MANADO"], ["CV UJI SATU", "BOGOR"], ...subconts.slice(4, 24).map(([n, c]) => [n, c[0]])];

const doRows = [["REKAP DELIVERY ORDER (DATA UJI)"], H];
for (let i = 1; i <= 300; i++) {
  const d = pick(dests);
  const ver = doStatus();
  const pic = ver ? "Budi Uji (081200000001)" : "";
  const photo = ver ? "https://drive.google.com/file/d/foto-uji/view" : "";
  for (const m of sample(MATS, 1 + Math.floor(rand() * 4))) {
    doRows.push([pic, photo, `DO2026${String(i).padStart(4, "0")}`, "YOFC WH", "CIKARANG", "YOFC WH CIKARANG", d[0], d[1], `${d[0]} ${d[1]}`, regionFor(d[1]), m, String(pick([2, 10, 50, 1200, 2000, 1500])), ver, photo]);
  }
}
const toRows = [H.map((h) => (h === "DO NUMBER" ? "TO NUMBER" : h))];
for (let i = 1; i <= 80; i++) {
  let [a, b] = sample(dests, 2);
  if (i % 3 === 0) a = [main, "GORONTALO"];
  if (a[0] === b[0] && a[1] === b[1]) continue;
  const ver = doStatus("to");
  for (const m of sample(MATS, 1 + Math.floor(rand() * 3))) {
    toRows.push(["", "", `TO2026${String(i).padStart(4, "0")}`, a[0], a[1], `${a[0]} ${a[1]}`, b[0], b[1], `${b[0]} ${b[1]}`, regionFor(b[1]), m, String(pick([5, 100, 300])), ver, ""]);
  }
}
// BOQ format sederhana (revisi 26 Nov 2026). Kolom Subcont City sengaja dikosongkan sebagian untuk menguji cadangan Subcont + City.
const boqRows = [["PIC Name", "Photo Evidence PIC", "Site Name", "Subcont", "City", "Subcont City", "Region", "Site Type", "Status", "Material Name", "QTY", "Verified", "Photo Evidence"]];
const boqOwners = [[main, "GORONTALO"], [main, "MANADO"], ["CV UJI SATU", "BOGOR"], ...subconts.slice(4).map(([n, c]) => [n, c[0]])];
for (let i = 1; i <= 900; i++) {
  const [sub, city] = i <= 420 ? pick(boqOwners.slice(0, 2)) : pick(boqOwners);
  const site = `${city} SITE ${String(i).padStart(3, "0")}`;
  const r = rand();
  // BOQ v5.3: dipilih subcont (APD / ABD / RFSC / FO CUT/VANDALISME) atau kosong.
  const ver = r < 0.06 ? "APD" : r < 0.1 ? "ABD" : r < 0.14 ? "RFSC" : r < 0.16 ? "FO CUT/VANDALISME" : "";
  const status = pick(["RFSC", "Redline", "BOQ Opname"]);
  const type = pick(["Distribution", "Feeder"]);
  for (const m of sample(MATS, 1 + Math.floor(rand() * 5))) {
    boqRows.push([ver ? "Sari Uji (081200000002)" : "", "", site, sub, city, rand() < 0.5 ? `${sub} ${city}` : "", regionFor(city), type, status, m, String(pick([1, 7, 22, 47, 320, 1020, 1900])), ver, ""]);
  }
}

writeFileSync(join(here, "fixtures/region.json"), JSON.stringify({ rows: regionRows }));
writeFileSync(join(here, "fixtures/orders.json"), JSON.stringify({ do: doRows, to: toRows, boq: boqRows }));
console.log(`region ${regionRows.length} baris, DO ${doRows.length}, TO ${toRows.length}, BOQ ${boqRows.length}`);
