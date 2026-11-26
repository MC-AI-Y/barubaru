/** Bantuan bersama untuk skrip e2e verifikasi. */
const path = require('path');
const fs = require('fs');
const SHOTS = process.env.E2E_SHOTS || path.join(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const B = process.env.E2E_BASE || 'http://127.0.0.1:4400';
const log = (...a) => console.log(...a);
const shot = (name) => path.join(SHOTS, name);

async function login(browser, name, pass, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['geolocation', 'camera'], geolocation: { latitude: 0.54, longitude: 123.06, accuracy: 10 } });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.route('https://api.bigdatacloud.net/**', (r) => r.fulfill({ json: { locality: 'Kota Tengah', city: 'Gorontalo', principalSubdivision: 'Gorontalo' } }));
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill(name);
  await p.locator('input[name=password]').fill(pass);
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  await p.getByRole('heading', { name: /^Halo,/ }).waitFor();
  return p;
}

async function shoot(p) {
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('button[aria-label^="Ambil"]')].pop(); return b && !b.disabled; }, null, { timeout: 15000 });
  await p.locator('button[aria-label^="Ambil"]').last().click();
  await p.getByRole('button', { name: 'Gunakan Foto' }).click();
}

const cards = (p) => p.locator('li > button[class*=OrdersScreen_card]');
const kpis = async (p, cls) => (await p.locator(`[class*=${cls}_kpiValue]`).allInnerTexts()).join(' / ');
const state = async (what) => (await fetch(B + what)).json();

/** v5.2: 2 foto — evidence (kamera belakang) lalu PIC (kamera depan). */
async function takeBoth(s) {
  await s.getByRole('button', { name: 'Ambil Foto Evidence' }).click();
  await shoot(s);
  await s.getByRole('button', { name: 'Ambil Foto PIC' }).click();
  await shoot(s);
}

/** Subcont: buka kartu pertama di tab aktif, isi PIC, ambil 2 foto, kirim. Mengembalikan judul dokumen. */
async function verifyFirst(s, { name = 'Budi Penerima', phone = '0812-3456-7890', boq = 'RFSC' } = {}) {
  await cards(s).first().waitFor();
  const number = await cards(s).first().locator('[class*=number]').innerText();
  await cards(s).first().click();
  await s.getByLabel('Nama PIC', { exact: true }).fill(name);
  await s.getByLabel('Nomor telepon PIC').fill(phone);
  await takeBoth(s);
  // BOQ (v5.3): subcont memilih status BOQ.
  if (await s.getByRole('radiogroup', { name: 'Status BOQ' }).count()) await s.getByRole('radio', { name: boq, exact: true }).click();
  await s.getByRole('button', { name: 'Kirim Verifikasi' }).click();
  await s.getByText(new RegExp(`${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} terkirim\\. Status:`)).waitFor({ timeout: 15000 });
  await s.getByRole('button', { name: 'Tutup panel' }).click();
  return number;
}

module.exports = { B, log, shot, login, shoot, cards, kpis, state, verifyFirst, takeBoth };
