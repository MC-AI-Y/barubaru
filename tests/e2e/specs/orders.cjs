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
const kpis = async (p) => (await p.locator('[class*=OrdersScreen_kpiValue]').allInnerTexts()).join(' / ');
(async () => {
  const browser = await chromium.launch();
  const s = await login(browser, 'cv uji kreasi nusantara', 'Uji12345', { width: 390, height: 844 });
  await s.getByText(/DO perlu diverifikasi/).waitFor({ timeout: 10000 });
  await s.waitForTimeout(300);
  log('hub todo:', (await s.locator('[class*=HubScreen_todoMain]').allInnerTexts()).join(' | '));
  log('badge:', (await s.locator('[class*=HubScreen_badge]').allInnerTexts()).join(','));
  await s.screenshot({ path: require('path').join(SHOTS, 'o-hub.png'), fullPage: true });

  await s.locator('button[aria-label^="DO"]').click();
  await s.locator('[class*=OrdersScreen_card]').first().waitFor();
  log('DO subcont KPI (total/perlu/verified/qty):', await kpis(s));
  log('DO kartu pertama:', (await s.locator('[class*=OrdersScreen_card]').first().innerText()).replace(/\n/g, ' | '));
  await s.screenshot({ path: require('path').join(SHOTS, 'o-do-hp.png') });
  await s.locator('[class*=OrdersScreen_card]').first().click();
  await s.getByRole('dialog').locator('table').waitFor();
  log('detail DO:', (await s.getByRole('dialog').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await s.waitForTimeout(700); await s.screenshot({ path: require('path').join(SHOTS, 'o-do-detail.png') });
  await s.getByRole('button', { name: 'Tutup panel' }).click();
  await s.getByRole('tab', { name: 'APPROVED' }).click();
  await s.waitForTimeout(600);
  log('tab APPROVED, chip:', [...new Set(await s.locator('[class*=OrdersScreen_card] [class*=chip]').allInnerTexts())].join(','));
  await s.getByLabel('Cari dokumen').fill('manado');
  await s.waitForTimeout(900);
  log('cari "manado":', await s.locator('[class*=OrdersScreen_count]').innerText());

  await s.getByRole('button', { name: 'Beranda', exact: true }).click();
  await s.locator('button[aria-label^="TO"]').click();
  await s.getByRole('tab', { name: 'Semua' }).click();
  await s.waitForTimeout(800);
  log('TO arah:', [...new Set(await s.locator('[class*=chipIn], [class*=chipOutDir]').allInnerTexts())].join(','));
  await s.screenshot({ path: require('path').join(SHOTS, 'o-to-hp.png') });

  await s.getByRole('button', { name: 'Beranda', exact: true }).click();
  await s.locator('button[aria-label^="BOQ"]').click();
  await s.locator('[class*=OrdersScreen_card]').first().waitFor();
  log('BOQ subcont KPI:', await kpis(s));
  await s.locator('[class*=OrdersScreen_card]').first().click();
  await s.getByRole('dialog').locator('table').waitFor();
  log('detail BOQ:', (await s.getByRole('dialog').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await s.waitForTimeout(700); await s.screenshot({ path: require('path').join(SHOTS, 'o-boq-detail.png') });
  const more = s.getByRole('button', { name: 'Muat lebih banyak' });
  if (await more.count()) { const before = await s.locator('[class*=OrdersScreen_card]').count(); await s.getByRole('button', { name: 'Tutup panel' }).click(); await more.click(); await s.waitForTimeout(800); log('muat lebih banyak:', before, '→', await s.locator('[class*=OrdersScreen_card]').count()); }

  // akses dokumen orang lain lewat API ditolak
  const other = await s.request.get(B + '/api/orders/detail?kind=do&key=' + encodeURIComponent('xxx-tidak-ada'));
  log('detail dokumen bukan miliknya:', other.status());

  const a = await login(browser, 'admin', 'Admin12345', { width: 1366, height: 768 });
  await a.waitForTimeout(1500);
  log('admin todo:', (await a.locator('[class*=HubScreen_todoMain]').allInnerTexts()).join(' | '));
  await a.screenshot({ path: require('path').join(SHOTS, 'o-admin-hub.png') });
  await a.locator('button[aria-label^="BOQ"]').click(); await a.getByRole('tab', { name: 'Semua' }).click();
  await a.locator('[class*=OrdersScreen_card]').first().waitFor();
  log('BOQ admin KPI:', await kpis(a));
  const opts = await a.locator('select[aria-label="Pilih subcont"] option').allInnerTexts();
  log('pilihan subcont admin:', opts.length, '| contoh:', opts.slice(0, 3).join(' ; '));
  await a.screenshot({ path: require('path').join(SHOTS, 'o-boq-admin.png') });
  await a.selectOption('select[aria-label="Pilih subcont"]', 'CV UJI KREASI NUSANTARA');
  await a.waitForTimeout(800);
  log('admin pilih UJI KREASI KPI:', await kpis(a));
  await a.getByRole('button', { name: 'Beranda', exact: true }).click();
  await a.locator('button[aria-label^="DO"]').click(); await a.getByRole('tab', { name: 'Semua' }).click();
  await a.locator('[class*=OrdersScreen_card]').first().waitFor();
  await a.screenshot({ path: require('path').join(SHOTS, 'o-do-admin.png') });
  log('DO admin KPI:', await kpis(a));
  log('error JS:', [...s.errs, ...a.errs].length ? [...s.errs, ...a.errs] : 'tidak ada');
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
