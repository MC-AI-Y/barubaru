const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname, '..', 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const B_ENV = process.env.E2E_BASE || 'http://127.0.0.1:4400';
const { chromium } = require('playwright');
const B = B_ENV;
const log = (...a) => console.log(...a);
async function shoot(p) {
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('button[aria-label^="Ambil"]')].pop(); return b && !b.disabled; }, null, { timeout: 15000 });
  await p.locator('button[aria-label^="Ambil"]').last().click();
  await p.getByRole('button', { name: 'Gunakan Foto' }).waitFor({ timeout: 15000 });
}
async function device(browser, ua) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation', 'camera'], geolocation: { latitude: -6.4817, longitude: 106.854, accuracy: 12 } });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route('https://api.bigdatacloud.net/**', r => r.fulfill({ json: { locality: 'Pakansari', city: 'Kabupaten Bogor', principalSubdivision: 'Jawa Barat' } }));
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill('cv uji kreasi nusantara');
  await p.locator('input[name=password]').fill('Uji12345');
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  return p;
}
const state = async () => (await (await fetch(B + '/__state')).json()).files.filter(f => (f.key || '').startsWith('DRAFT:'));
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const A = await device(browser, 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36');
  await A.locator('button[aria-label^=\"Visit\"]').click(); await A.getByRole('button', { name: 'Mulai Laporan' }).click();
  await A.getByRole('button', { name: 'Ambil Selfie' }).click();
  await shoot(A); await A.getByRole('button', { name: 'Gunakan Foto' }).click();
  await A.getByRole('button', { name: 'Lanjut' }).click();
  await A.getByLabel(/^Kota gudang/).selectOption({ label: 'Manado' });
  await A.getByLabel('Warehouse Name').fill('Gudang Manado Utara');
  await A.waitForTimeout(2500);
  log('A: marker setelah isi gudang:', JSON.stringify((await state()).map(f => [f.props.whcWh, f.props.whcMc, f.props.whcLbl])));

  const Bp = await device(browser, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  await Bp.waitForTimeout(3000); await Bp.screenshot({ path: require('path').join(SHOTS, 'dbg-B.png'), fullPage: true }); await Bp.getByText('1 laporan Visit belum terkirim di perangkat lain').waitFor({ timeout: 8000 });
  await Bp.screenshot({ path: require('path').join(SHOTS, 'dev-B-hub.png') });
  log('B: hub menampilkan Perlu tindakan + badge Visit:', await Bp.locator('button[aria-label^="Visit"] [class*=HubScreen_badge]').innerText());
  await Bp.locator('button[aria-label^="Visit"]').click();
  await Bp.getByText('Ada laporan belum terkirim di perangkat lain').waitFor({ timeout: 8000 });
  await Bp.waitForTimeout(400);
  await Bp.screenshot({ path: require('path').join(SHOTS, 'dev-B-notice.png') });
  log('B melihat pemberitahuan: ya |', (await Bp.locator('li').first().innerText()).replace(/\n/g, ' / '));

  // A sendiri tidak melihat pemberitahuan tentang draf miliknya
  await A.goto(B); await A.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).waitFor(); await A.waitForTimeout(1500);
  log('A tidak melihat pemberitahuan sendiri:', (await A.getByText('perangkat lain').count()) === 0);

  // A buang draf -> marker hilang -> B setelah reload tidak melihat lagi
  await A.locator('button[aria-label^="Visit"]').click();
  await A.getByRole('button', { name: 'Buang Draf' }).click();
  await A.getByRole('alertdialog').getByRole('button', { name: 'Buang draf' }).click();
  await A.waitForTimeout(1500);
  log('marker setelah buang draf:', (await state()).length);
  await Bp.reload(); await Bp.locator('button[aria-label^="Visit"]').waitFor(); await Bp.waitForTimeout(1500);
  log('B tidak melihat pemberitahuan lagi:', (await Bp.getByText('perangkat lain').count()) === 0);

  // B: hapus pemberitahuan manual
  await A.getByRole('button', { name: 'Mulai Laporan' }).click();
  await A.getByRole('button', { name: 'Ambil Selfie' }).click();
  await shoot(A); await A.getByRole('button', { name: 'Gunakan Foto' }).click();
  await A.waitForTimeout(2500);
  await Bp.reload(); await Bp.locator('button[aria-label^="Visit"]').click(); await Bp.getByText('Gudang belum diisi').waitFor({ timeout: 8000 });
  await Bp.getByRole('button', { name: 'Hapus pemberitahuan' }).click();
  await Bp.getByRole('alertdialog').getByRole('button', { name: 'Hapus pemberitahuan' }).click();
  await Bp.waitForTimeout(800);
  log('hapus manual oleh B:', (await Bp.getByText('perangkat lain').count()) === 0, '| marker:', (await state()).length);
  log('error JS:', [...A.errs, ...Bp.errs].length ? [...A.errs, ...Bp.errs] : 'tidak ada');
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
