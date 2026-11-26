const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname, '..', 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const B_ENV = process.env.E2E_BASE || 'http://127.0.0.1:4400';
const { chromium } = require('playwright');
const B = B_ENV;
const log = (...a) => console.log(...a);
async function login(p, name, pw) {
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill(name);
  await p.locator('input[name=password]').fill(pw);
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  await p.getByRole('heading', { name: /^Halo,/ }).waitFor();
}
(async () => {
  // 1. Kamera ditolak
  {
    const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'] });
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: -6.2, longitude: 106.8 } });
    const p = await c.newPage();
    await login(p, 'CV UJI SATU', 'Daya4385');
    await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: /Mulai Laporan|Lanjutkan Pengisian Form/ }).click();
    await p.getByRole('button', { name: 'Ambil Selfie' }).click();
    await p.locator('[role=dialog]').getByRole('button', { name: 'Coba Lagi' }).waitFor({ timeout: 15000 });
    log('kamera ditolak →', await p.locator('[role=dialog] p').nth(1).innerText());
    await p.screenshot({ path: require('path').join(SHOTS, 'e-kamera-ditolak.png') });
    await b.close();
  }
  // 2. Lokasi ditolak
  {
    const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    const p = await c.newPage();
    await login(p, 'CV UJI SATU', 'Daya4385');
    await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: /Mulai Laporan|Lanjutkan Pengisian Form/ }).click();
    await p.getByRole('button', { name: 'Ambil Selfie' }).click();
    await p.getByText(/Izin lokasi wajib aktif/).waitFor({ timeout: 15000 });
    log('lokasi ditolak → kartu petunjuk tampil; tombol potret nonaktif:', await p.locator('button[aria-label="Ambil selfie"]').isDisabled());
    await p.screenshot({ path: require('path').join(SHOTS, 'e-lokasi-ditolak.png') });
    await b.close();
  }
  // 3. Portrait diblokir (HP) + 4. sesi berakhir di tengah jalan
  {
    const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera', 'geolocation'], geolocation: { latitude: -6.2, longitude: 106.8 } });
    const p = await c.newPage();
    await login(p, 'CV UJI SATU', 'Daya4385');
    await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: /Mulai Laporan|Lanjutkan Pengisian Form/ }).click();
    await p.getByRole('button', { name: 'Ambil Selfie' }).click();
    await p.waitForFunction(() => { const b = document.querySelector('button[aria-label="Ambil selfie"]'); return b && !b.disabled; }, null, { timeout: 15000 });
    await p.locator('button[aria-label="Ambil selfie"]').tap();
    await p.getByRole('button', { name: 'Gunakan Foto' }).tap();
    await p.getByRole('button', { name: 'Lanjut' }).tap();
    await p.getByLabel(/^Kota gudang/).selectOption({ label: 'Bogor' });
    for (const [l, v] of [['Warehouse Name', 'WH'], ['PIC Subcont', 'A'], ['YOFC SPV', 'B'], ['YOFC PM/RPM', 'C']]) await p.getByLabel(l).fill(v);
    await p.getByRole('button', { name: 'Lanjut' }).tap();
    await p.getByRole('combobox', { name: 'Material', exact: true }).selectOption('FDT-48');
    await p.getByLabel('Quantity').fill('1');
    await p.getByRole('button', { name: 'Ambil Foto Material' }).tap();
    await p.getByText('Putar HP ke mode landscape').waitFor({ timeout: 10000 });
    log('portrait → arahan putar HP tampil; tombol potret nonaktif:', await p.locator('button[aria-label="Ambil foto material"]').isDisabled());
    await p.screenshot({ path: require('path').join(SHOTS, 'e-portrait.png') });
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(900);
    log('landscape → tombol potret aktif:', !(await p.locator('button[aria-label="Ambil foto material"]').isDisabled()));
    await p.screenshot({ path: require('path').join(SHOTS, 'e-landscape.png') });
    // sesi berakhir
    await c.clearCookies();
    await p.locator('button[aria-label="Ambil foto material"]').tap();
    await p.getByRole('button', { name: 'Login', exact: true }).waitFor({ timeout: 15000 });
    log('sesi berakhir saat memotret → kembali ke Beranda (login), toast:', await p.locator('[role=status], [role=alert]').filter({ hasText: 'Sesi' }).first().innerText());
    await login(p, 'cv uji satu', 'Daya4385');
    await p.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).waitFor({ timeout: 8000 }).then(() => log('setelah login lagi, draf masih ada: ya'), () => log('setelah login lagi, draf masih ada: TIDAK'));
    await b.close();
  }
  // 5. Nama subcont panjang
  {
    const b = await chromium.launch();
    const c = await b.newContext({ viewport: { width: 360, height: 740 } });
    const p = await c.newPage();
    await login(p, 'pt koperasi pegawai pt. uji telekom, tbk (kopujitel)', 'Kop12345');
    await p.screenshot({ path: require('path').join(SHOTS, 'e-nama-panjang.png') });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    log('nama panjang di 360px, meluber horizontal:', ov);
    await b.close();
  }
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
