const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname, '..', 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const B_ENV = process.env.E2E_BASE || 'http://127.0.0.1:4400';
// Uji flash & fokus dengan kemampuan kamera disimulasikan (Chromium uji tidak punya torch/fokus).
const { chromium } = require('playwright');
const B = B_ENV;
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const simulate of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, permissions: ['geolocation', 'camera'], geolocation: { latitude: -6.48, longitude: 106.85, accuracy: 12 } });
    if (simulate) await ctx.addInitScript(() => {
      window.__applied = [];
      MediaStreamTrack.prototype.getCapabilities = function () { return { torch: true, focusMode: ['manual', 'single-shot', 'continuous'], pointsOfInterest: {} }; };
      const orig = MediaStreamTrack.prototype.applyConstraints;
      MediaStreamTrack.prototype.applyConstraints = function (c) { window.__applied.push(JSON.stringify(c)); return Promise.resolve(); };
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('https://api.bigdatacloud.net/**', r => r.fulfill({ json: { locality: 'X', city: 'Y', principalSubdivision: 'Z' } }));
    await p.goto(B);
    await p.getByRole('button', { name: 'Login', exact: true }).click();
    await p.getByLabel(/^Subcont/).fill('cv uji kreasi nusantara');
    await p.locator('input[name=password]').fill('Uji12345');
    await p.getByRole('button', { name: 'Masuk', exact: true }).click();
    await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: 'Mulai Laporan' }).click();
    await p.getByRole('button', { name: 'Ambil Selfie' }).click();
    await p.waitForFunction(() => { const b = [...document.querySelectorAll('button[aria-label^="Ambil"]')].pop(); return b && !b.disabled; }, null, { timeout: 15000 });
    await p.waitForTimeout(500);
    const label = simulate ? 'DIDUKUNG' : 'TIDAK DIDUKUNG';
    const flashBtn = p.getByRole('button', { name: 'Nyalakan flash' });
    console.log(`[${label}] tombol flash tampil:`, await flashBtn.count() === 1, '| petunjuk fokus:', await p.getByText('ketuk layar untuk fokus').count() === 1);
    if (simulate) {
      await flashBtn.click(); await p.waitForTimeout(200);
      console.log(`[${label}] flash nyala:`, await p.getByRole('button', { name: 'Matikan flash' }).count() === 1);
      await p.screenshot({ path: require('path').join(SHOTS, 'cam-flash-on.png') });
      const box = await p.locator('video').boundingBox();
      await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await p.waitForTimeout(250);
      await p.screenshot({ path: require('path').join(SHOTS, 'cam-focus.png') });
      console.log(`[${label}] cincin fokus tampil:`, await p.locator('[class*=focusRing]').count() === 1);
      await p.getByRole('button', { name: 'Matikan flash' }).click(); await p.waitForTimeout(200);
      const applied = await p.evaluate(() => window.__applied);
      console.log(`[${label}] perintah ke kamera:`, applied.join('  '));
      // Foto tetap bisa diambil
      await p.locator('button[aria-label^="Ambil"]').last().click();
      await p.getByRole('button', { name: 'Gunakan Foto' }).waitFor({ timeout: 15000 });
      console.log(`[${label}] foto tetap bisa diambil: ya`);
    }
    console.log(`[${label}] error JS:`, errs.length ? errs : 'tidak ada');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
