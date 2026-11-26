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
  await p.getByRole('button', { name: 'Gunakan Foto' }).click();
  await p.getByRole('dialog').waitFor({ state: 'detached' });
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['geolocation', 'camera'], geolocation: { latitude: 3.5952, longitude: 98.6722, accuracy: 9 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill('PT UJI BAHARI KONSTRUKSI');
  await p.locator('input[name=password]').fill('Bahari22');
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: 'Mulai Laporan' }).click();
  await p.getByRole('button', { name: 'Ambil Selfie' }).click(); await shoot(p);
  await p.getByRole('button', { name: 'Lanjut' }).click();
  await p.getByLabel(/^Kota gudang/).waitFor();
  log('jumlah kota (pilihan):', (await p.getByLabel(/^Kota gudang/).locator('option').count()) - 1);
  await p.screenshot({ path: require('path').join(SHOTS, 'r-22kota.png') });
  const opts = await p.getByLabel(/^Kota gudang/).locator('option').allInnerTexts();
  await p.getByLabel(/^Kota gudang/).selectOption({ label: opts[6] });
  for (const [l, v] of [['Warehouse Name', 'Gudang Medan'], ['PIC Subcont', 'Rina'], ['YOFC SPV', 'Doni'], ['YOFC PM/RPM', 'Eko']]) await p.getByLabel(l).fill(v);
  await p.getByRole('button', { name: 'Lanjut' }).click();
  await p.getByRole('combobox', { name: 'Material', exact: true }).selectOption('HDPE-32/28');
  await p.getByLabel('Quantity').fill('100');
  await p.getByRole('button', { name: 'Ambil Foto Material' }).click(); await shoot(p);
  await p.getByRole('button', { name: 'Material', exact: true }).click();
  // Suntik 99 material tambahan langsung ke draf (menyalin foto pertama dengan photoId baru).
  await p.waitForTimeout(500);
  await p.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('whcontrol', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = (store, key) => new Promise((res) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); });
    const key = 'pt uji bahari konstruksi';
    const d = await get('drafts', key);
    const m0 = d.materials[0];
    const photo = await get('photos', m0.photo.id);
    const tx = db.transaction(['photos', 'drafts'], 'readwrite');
    const names = [['CABLE-48', 'Old (Hitam)'], ['FDT-48', '-'], ['POLE-7M 2,5"', 'USPl'], ['CLOSURE-24', 'Dome']];
    for (let i = 1; i < 100; i++) {
      const id = crypto.randomUUID();
      tx.objectStore('photos').put({ ...photo, id });
      const [material, remark] = names[i % 4];
      // capture asli (bertanda tangan) dipakai ulang; isi watermark tidak relevan untuk uji ini
      d.materials.push({ ...m0, id: crypto.randomUUID(), material, remark, quantity: String(i), unit: /CABLE|KABEL|HDPE/.test(material) ? 'M' : 'Pcs', notes: i % 10 === 0 ? 'Catatan uji panjang untuk memastikan tabel PDF membungkus teks dengan rapi.' : '', photo: { ...m0.photo, id } });
    }
    d.step = 'review';
    tx.objectStore('drafts').put(d, key);
    await new Promise((res) => (tx.oncomplete = res));
  });
  await p.reload();
  await p.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).click();
  const t0 = Date.now();
  await p.getByText('Material (100)').waitFor();
  log('Review 100 material tampil dalam', Date.now() - t0, 'ms');
  await p.screenshot({ path: require('path').join(SHOTS, 'r-review100.png') });
  await p.getByRole('button', { name: 'Ambil Foto Penutup & Submit' }).click();
  await p.getByRole('button', { name: 'Ambil Foto Penutup', exact: true }).click(); await shoot(p);

  // Putus koneksi setelah 20 unggahan berhasil.
  let passed = 0;
  await p.route('**/api/upload', async (route) => { if (passed < 20) { passed++; await route.continue(); } else await route.abort('internetdisconnected'); });
  await p.getByRole('button', { name: 'Kirim Laporan' }).click();
  await p.getByText('Pengiriman belum selesai').waitFor({ timeout: 60000 });
  await p.screenshot({ path: require('path').join(SHOTS, 'r-putus.png') });
  let st = await (await p.request.get(B + '/__state')).json();
  const before = st.files.length;
  log('setelah putus: file di Drive =', before, '| baris sheet =', st.rows.length - 1);
  // Tab ditutup di tengah proses: muat ulang, draf + bukti unggah tetap ada.
  await p.unroute('**/api/upload');
  await p.reload();
  await p.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).click();
  await p.getByRole('button', { name: 'Kirim Laporan' }).click();
  // Respons /api/submit pertama "hilang" (server sudah memproses, klien tidak menerima).
  let first = true;
  await p.route('**/api/submit', async (route) => { if (first) { first = false; await route.fetch(); await route.abort('connectionreset'); } else await route.continue(); });
  await p.getByText('Laporan berhasil dikirim').waitFor({ timeout: 120000 });
  log('pesan Selesai:', await p.locator('#screen-title + p').innerText());
  st = await (await p.request.get(B + '/__state')).json();
  const uploads = st.files.filter(f => f.name.endsWith('.jpg'));
  const keys = new Set(uploads.map(f => f.key));
  const rows = st.rows.filter(r => r[1] === 'PT UJI BAHARI KONSTRUKSI');
  log('file jpg laporan ini:', uploads.filter(f => f.name.includes('BAHARI')).length, '| kunci unik:', keys.size === uploads.length, '| baris laporan ini:', rows.length, '| Region:', rows[0][6]);
  log('PDF laporan ini:', st.files.filter(f => f.name.includes('BAHARI') && f.name.endsWith('.pdf')).length);
  const href = await p.locator('a[download]').getAttribute('href');
  require('fs').writeFileSync(require('path').join(SHOTS, 'laporan-100-material.pdf'), await (await p.request.get(B + href)).body());
  log(errs.length ? 'ERR ' + errs.join(' | ') : 'tanpa error JS');
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
