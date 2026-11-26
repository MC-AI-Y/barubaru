const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname, '..', 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const B_ENV = process.env.E2E_BASE || 'http://127.0.0.1:4400';
const { chromium } = require('playwright');
const B = B_ENV;
const log = (...a) => console.log(...a);
async function login(browser, name, pass, viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill(name);
  await p.locator('input[name=password]').fill(pass);
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  await p.getByRole('heading', { name: /^Halo,/ }).waitFor();
  return p;
}
// Ringkasan isi Dashboard (kartu KPI dihapus di v5.3.3): jumlah baris tabel + total kolom By Data dari API pada filter aktif tidak tersedia di UI,
// jadi dipakai judul tabel dan baris pertama.
const kpis = async (p) => `${await p.locator('h2', { hasText: 'Tabel detail' }).innerText()} | ${(await p.locator('[class*=DashboardScreen_detail] tbody tr').first().innerText()).replace(/\t/g, ' ')}`;
const box = (p, name) => p.getByRole('combobox', { name, exact: true });
(async () => {
  const browser = await chromium.launch();
  const s = await login(browser, 'cv uji kreasi nusantara', 'Uji12345', { width: 390, height: 844 });
  await s.locator('button[aria-label^="Dashboard"]').click();
  await s.locator('h2', { hasText: 'Tabel detail' }).waitFor({ timeout: 20000 });
  log('subcont ringkasan:', await kpis(s));
  // Revisi minor: bagian berikut tidak boleh ada lagi (admin dan subcont).
  const gone = async (p) => ({
    hitungDari: await p.getByText('Hitung dari:').count(),
    kartuKPI: await p.locator('[class*=DashboardScreen_kpi]').count() + await p.getByText('Inventory By Data', { exact: true }).count(),
    peringatanGAP: await p.locator('section[aria-label="Peringatan GAP"]').count(),
    visitTerakhir: await p.locator('section[aria-label="Visit terakhir"]').count(),
    peringkat: await p.locator('section[aria-label="Peringkat Subcont City"]').count(),
    notifBiru: await p.getByText(/belum diverifikasi:/).count(),
    select: await p.locator('[class*=DashboardScreen] select').count(),
  });
  log('subcont bagian yang dihapus (semua harus 0):', JSON.stringify(await gone(s)));
  log('subcont filter (harus sama dengan admin):', (await s.getByRole('combobox').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join(' | '));
  await box(s, 'Filter subcont').click();
  log('subcont daftar Subcont:', (await s.getByRole('option').allInnerTexts()).join(' | '));
  await box(s, 'Filter subcont').press('Escape');
  const cityBox = box(s, 'Filter city');
  await cityBox.click();
  log('subcont kota (daftar):', (await s.getByRole('option').allInnerTexts()).join(' | '));
  await cityBox.fill('g');
  log('ketik "g" → daftar:', (await s.getByRole('option').allInnerTexts()).join(' | '));
  await cityBox.press('Escape');
  log('Esc mengembalikan teks:', JSON.stringify(await cityBox.inputValue()));
  const sv = s.locator('section[aria-label="Stock by Data vs Stock Visit per material"]');
  log('grafik Stock by Data vs Stock Visit:', (await sv.locator('li').first().innerText()).replace(/\n/g, ' / '));
  log('grafik In vs Out masih ada:', await s.locator('section[aria-label="In vs Out per material"]').count());
  log('baris tabel:', await s.locator('[class*=DashboardScreen_detail] tbody tr').count(), '| judul:', await s.locator('h2', { hasText: 'Tabel detail' }).innerText());
  log('tombol Perbarui SMDT untuk subcont:', await s.getByRole('button', { name: 'Perbarui SMDT' }).count());
  await s.screenshot({ path: require('path').join(SHOTS, 'd-sub-hp.png'), fullPage: true });
  await cityBox.click();
  await cityBox.fill('goro');
  await s.getByRole('option', { name: 'GORONTALO', exact: true }).click();
  await s.waitForTimeout(300);
  log('pilihan diklik → kotak berisi:', await cityBox.inputValue());
  log('filter GORONTALO KPI:', await kpis(s));
  const [dl] = await Promise.all([s.waitForEvent('download'), s.getByRole('button', { name: 'Unduh CSV' }).click()]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  log('CSV:', dl.suggestedFilename(), '|', csv.split('\r\n').length - 1, 'baris |', csv.split('\r\n')[1]);
  const dapi = await (await s.request.get(B + '/api/dashboard')).json();
  log('API subcont hanya miliknya:', dapi.rows.every(r => r.subcontCity.startsWith('CV UJI KREASI')), '| ranking:', dapi.ranking);
  const forbidden = await s.request.post(B + '/api/admin/smdt-sync', { headers: { Origin: B } });
  log('subcont panggil smdt-sync:', forbidden.status());

  const a = await login(browser, 'admin', 'Admin12345', { width: 1366, height: 900 });
  await a.locator('button[aria-label^="Dashboard"]').click();
  await a.locator('h2', { hasText: 'Tabel detail' }).waitFor({ timeout: 20000 });
  log('admin ringkasan:', await kpis(a));
  log('admin filter:', (await a.getByRole('combobox').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join(' | '));
  log('admin bagian yang dihapus (semua harus 0):', JSON.stringify(await gone(a)));
  const regBox = a.getByRole('combobox', { name: 'Filter region' });
  await regBox.click();
  log('admin region (daftar):', (await a.getByRole('option').allInnerTexts()).join(' | '));
  await regBox.press('ArrowDown');
  await regBox.press('Enter');
  log('keyboard ↓ Enter → region:', await regBox.inputValue(), '| KPI:', await kpis(a));
  await a.getByRole('button', { name: 'Hapus pilihan Filter region' }).click();
  log('hapus pilihan → region:', JSON.stringify(await regBox.inputValue()), '| KPI:', await kpis(a));
  // City tanpa Subcont: semua subcont di kota itu; lalu Subcont mempersempit daftar City.
  await box(a, 'Filter city').click();
  log('admin daftar City (awal):', (await a.getByRole('option').count()) - 1, 'kota');
  await box(a, 'Filter city').fill('jakarta');
  await a.getByRole('option', { name: 'JAKARTA', exact: true }).click();
  log('City JAKARTA saja:', await kpis(a));
  await a.getByRole('button', { name: 'Hapus pilihan Filter city' }).click();
  await box(a, 'Filter subcont').fill('kreasi');
  await a.getByRole('option').first().click();
  log('Subcont dipilih:', await box(a, 'Filter subcont').inputValue());
  await box(a, 'Filter city').click();
  log('daftar City setelah Subcont dipilih:', (await a.getByRole('option').allInnerTexts()).join(' | '));
  await box(a, 'Filter city').press('Escape');
  await a.getByRole('button', { name: 'Hapus pilihan Filter subcont' }).click();
  const mat = a.getByRole('combobox', { name: 'Filter material' });
  await mat.fill('zzz');
  log('ketik tidak cocok:', await a.getByText('Tidak ada yang cocok').count());
  await mat.press('Escape');
  await a.screenshot({ path: require('path').join(SHOTS, 'd-admin.png'), fullPage: true });
  await a.getByRole('button', { name: 'Perbarui SMDT' }).click();
  await a.getByRole('alertdialog').getByRole('button', { name: 'Perbarui SMDT' }).click();
  await a.getByText(/SMDT diperbarui/).waitFor({ timeout: 20000 });
  log('toast:', await a.getByText(/SMDT diperbarui/).innerText());
  const smdt = (await (await fetch(B + '/__smdt')).json()).rows;
  log('SMDT: baris data =', smdt.length - 2, '| baris lama hilang:', !smdt.some(r => r[1] === 'BARIS LAMA'));
  const g = smdt.find(r => r[1] === 'CV UJI KREASI NUSANTARA GORONTALO' && r[2] === 'CABLE-48');
  log('SMDT GORONTALO CABLE-48:', JSON.stringify(g));
  log('header tetap:', smdt[1][1], smdt[0][3]);
  // Material dengan nilai nol semua tidak ditulis
  log('semua baris punya data:', smdt.slice(2).every(r => [3, 4, 6, 7, 10].some(i => Number(r[i] || 0) !== 0)));
  log('error JS:', [...s.errs, ...a.errs].length ? [...s.errs, ...a.errs] : 'tidak ada');
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
