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
  await p.waitForTimeout(500);
  return p;
}
(async () => {
  const browser = await chromium.launch();
  for (const [tag, vp] of [['hp', { width: 390, height: 844 }], ['laptop', { width: 1366, height: 768 }]]) {
    const s = await login(browser, 'cv uji kreasi nusantara', 'Uji12345', vp);
    await s.screenshot({ path: require('path').join(SHOTS, `hub-subcont-${tag}.png`), fullPage: true });
    log(`[${tag}] subcont judul:`, await s.getByRole('heading', { name: /^Halo,/ }).innerText());
    log(`[${tag}] menu:`, (await s.locator('[class*=HubScreen_tileLabel]').allInnerTexts()).join(', '));
    const a = await login(browser, 'ADMIN', 'Admin12345', vp);
    await a.screenshot({ path: require('path').join(SHOTS, `hub-admin-${tag}.png`), fullPage: true });
    log(`[${tag}] admin judul:`, await a.getByRole('heading', { name: /^Halo,/ }).innerText(), '| status Visit:', await a.locator('button[aria-label^="Visit"] [class*=tileStatus]').innerText());
    if (tag === 'hp') {
      await a.locator('button[aria-label^="Visit"]').click();
      log('admin buka Visit:', await a.getByRole('heading', { level: 1 }).innerText());
      await a.screenshot({ path: require('path').join(SHOTS, 'admin-visit.png') });
      const r = await a.request.get(B + '/api/reference/regions');
      log('admin GET /api/reference/regions:', r.status(), (await r.json()).message);
      const ses = await (await a.request.get(B + '/api/auth/session')).json();
      log('admin session:', ses.subcontName, ses.role);
      await a.getByRole('button', { name: 'Kembali ke Beranda' }).last().click();
      await a.locator('button[aria-label^="DO"]').click();
      log('DO placeholder:', await a.getByRole('heading', { level: 1 }).innerText(), '|', await a.getByText('Sedang disiapkan').count());
      await a.screenshot({ path: require('path').join(SHOTS, 'do-placeholder.png') });
      await a.getByRole('button', { name: 'Kembali', exact: false }).last().click();
      await a.getByRole('heading', { name: /^Halo,/ }).waitFor();
      log('kembali ke hub: ya');
      const sr = await s.request.get(B + '/api/reference/regions');
      log('subcont GET /api/reference/regions:', sr.status());
      const ss = await (await s.request.get(B + '/api/auth/session')).json();
      log('subcont session role:', ss.role);
      await s.locator('button[aria-label^="Visit"]').click();
      log('subcont buka Visit:', await s.getByRole('heading', { level: 1 }).innerText());
      await s.screenshot({ path: require('path').join(SHOTS, 'visit-home.png') });
    }
    log('error JS:', [...s.errs, ...a.errs].length ? [...s.errs, ...a.errs] : 'tidak ada');
  }
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
