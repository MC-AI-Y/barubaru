const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname, '..', 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const B_ENV = process.env.E2E_BASE || 'http://127.0.0.1:4400';
const { chromium } = require('playwright');
const B = B_ENV;
const log = (...a) => console.log(...a);
async function snap(p, n) { await p.waitForTimeout(350); await p.screenshot({ path: require('path').join(SHOTS, `f-${n}.png`) }); }
async function shoot(p) {
  const sh = p.locator('button[aria-label^="Ambil"]').last();
  await sh.waitFor(); await p.waitForFunction(() => { const b = [...document.querySelectorAll('button[aria-label^="Ambil"]')].pop(); return b && !b.disabled; }, null, { timeout: 15000 });
  await sh.click();
  await p.getByRole('button', { name: 'Gunakan Foto' }).waitFor({ timeout: 15000 });
}
async function addMaterial(p, mat, remark, qty, unit, notes, commit = true) {
  await p.getByRole('combobox', { name: 'Material', exact: true }).selectOption(mat);
  if (remark) await p.getByRole('combobox', { name: 'Remark', exact: true }).selectOption(remark);
  await p.getByLabel('Quantity').fill(qty);
  log(`quantity ketik ${qty} → tampil:`, await p.getByLabel('Quantity').inputValue());
  const sat = p.getByRole('combobox', { name: 'Satuan', exact: true });
  log(`satuan otomatis ${mat}:`, await sat.inputValue(), '| terkunci:', await sat.isDisabled(), '| sesuai harapan:', (await sat.inputValue()) === unit);
  if (notes) await p.getByLabel('Notes (opsional)').fill(notes);
  await p.getByRole('button', { name: 'Ambil Foto Material' }).click();
  await shoot(p);
  await p.getByRole('button', { name: 'Gunakan Foto' }).click();
  await p.getByRole('dialog').waitFor({ state: 'detached' });
  if (commit) await p.getByRole('button', { name: 'Material', exact: true }).click();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation', 'camera'], geolocation: { latitude: -6.4817, longitude: 106.8540, accuracy: 12 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/40[19]|422/.test(m.text()) && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.route('https://api.bigdatacloud.net/**', r => r.fulfill({ json: { locality: 'Pakansari', city: 'Kabupaten Bogor', principalSubdivision: 'Jawa Barat' } }));
  await p.goto(B);
  await p.getByRole('button', { name: 'Login', exact: true }).click();
  await p.getByLabel(/^Subcont/).fill('cv uji kreasi nusantara');
  await p.locator('input[name=password]').fill('Uji12345');
  await p.getByRole('button', { name: 'Masuk', exact: true }).click();
  await p.locator('button[aria-label^=\"Visit\"]').click(); await p.getByRole('button', { name: 'Mulai Laporan' }).click();
  await p.getByRole('button', { name: 'Ambil Selfie' }).click();
  await shoot(p); await snap(p, '01-pao-preview');
  await p.getByRole('button', { name: 'Gunakan Foto' }).click();
  await p.getByText('Ambil Ulang').waitFor(); await snap(p, '02-pao-done');
  await p.getByRole('button', { name: 'Lanjut' }).click();
  // Gudang: validasi
  await p.waitForFunction(() => { const s = [...document.querySelectorAll('select')].find(x => x.labels?.[0]?.textContent?.startsWith('Kota gudang')); return s && s.options.length > 1; });
  await p.getByRole('button', { name: 'Lanjut' }).click(); await snap(p, '03-gudang-errors');
  await p.getByLabel(/^Kota gudang/).selectOption({ label: 'Manado' });
  await p.getByLabel('Warehouse Name').fill('Gudang Manado Utara');
  await p.getByLabel('PIC Subcont').fill('Budi Santoso');
  await p.getByLabel('YOFC SPV').fill('Sari Wulandari');
  await p.getByLabel('YOFC PM/RPM').fill('Andi Pratama');
  await snap(p, '04-gudang-filled');
  await p.getByRole('button', { name: 'Lanjut' }).click();
  // Material: tombol foto nonaktif sebelum lengkap
  await p.getByRole('combobox', { name: 'Material', exact: true }).waitFor();
  log('foto nonaktif sebelum lengkap:', await p.getByRole('button', { name: 'Ambil Foto Material' }).isDisabled());
  await addMaterial(p, 'CABLE-48', 'Old (Hitam)', '1200', 'M', 'Gulungan di rak A');
  await p.getByRole('combobox', { name: 'Material', exact: true }).selectOption('FDT-48');
  log('remark FDT otomatis:', await p.getByRole('combobox', { name: 'Remark', exact: true }).inputValue());
  await addMaterial(p, 'FDT-48', null, '2', 'Pcs', '');
  // draf bertahan setelah refresh
  await p.reload(); await p.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).waitFor();
  await snap(p, '05-home-resume');
  await p.getByRole('button', { name: 'Lanjutkan Pengisian Form' }).click();
  await p.getByRole('button', { name: /Daftar material sementara, 2 item/ }).waitFor();
  log('draf bertahan setelah refresh: 2 material');
  await addMaterial(p, 'POLE-7M 2,5"', 'USPl', '3', 'Pcs', '', false);
  await snap(p, '06-material-photo');
  // ubah qty setelah foto -> konfirmasi -> batal
  await p.getByLabel('Quantity').fill('4');
  await p.getByRole('alertdialog').waitFor(); await snap(p, '07-confirm-change');
  await p.getByRole('button', { name: 'Batal' }).click();
  log('qty tetap 3 setelah batal:', await p.getByLabel('Quantity').inputValue());
  await p.getByRole('button', { name: /Daftar material/ }).click(); await snap(p, '08-cart');
  await p.getByRole('button', { name: 'Tutup panel' }).click();
  await p.getByRole('button', { name: 'Review', exact: true }).click();
  await p.getByText('#3 POLE-7M 2,5"').waitFor(); await snap(p, '09-review');
  // gudang terkunci
  await p.getByRole('button', { name: 'Lihat/ubah' }).click();
  log('gudang terkunci:', await p.getByLabel('Warehouse Name').isDisabled());
  await snap(p, '10-gudang-locked');
  await p.getByRole('button', { name: 'Kembali', exact: true }).click();
  await p.getByRole('button', { name: 'Ambil Foto Penutup & Submit' }).click();
  await p.getByRole('button', { name: 'Ambil Foto Penutup', exact: true }).click();
  await p.getByText('Kamera belakang · tanpa galeri').waitFor();
  log('PAC kamera belakang, tidak dicerminkan:', (await p.locator('video[class*=mirror]').count()) === 0);
  await p.screenshot({ path: require('path').join(SHOTS, 'f-pac-camera.png') });
  await shoot(p); await p.getByRole('button', { name: 'Gunakan Foto' }).click();
  await p.getByRole('button', { name: 'Kirim Laporan' }).click();
  await p.getByText('Laporan berhasil dikirim').waitFor({ timeout: 30000 }); await snap(p, '11-done');
  const st = await (await p.request.get(B + '/__state')).json();
  log('baris sheet:', st.rows.length - 1, '| file:', st.files.map(f => `${f.parents[0]}:${f.name}`).join(', '));
  log('nominatim dipanggil:', st.nominatimCalls, 'kali');
  log('format kolom Quantity:', JSON.stringify(st.formatCalls));
  for (const r of st.rows.slice(1)) log('  ', JSON.stringify(r).slice(0, 400));
  const href = await p.locator('a[download]').getAttribute('href');
  const pdf = await p.request.get(B + href);
  log('unduh PDF:', pdf.status(), pdf.headers()['content-disposition'], (await pdf.body()).subarray(0, 4).toString());
  require('fs').writeFileSync(require('path').join(SHOTS, 'laporan.pdf'), await pdf.body());
  const evid = st.files.find(f => f.parents[0] === 'FOLDER_EVID');
  require('fs').writeFileSync(require('path').join(SHOTS, 'f-watermark.jpg'), await (await p.request.get(B + '/__file?id=' + evid.id)).body());
  await p.getByRole('button', { name: 'Selesai' }).click();
  await p.getByRole('button', { name: 'Mulai Laporan' }).waitFor(); log('kembali ke Beranda, draf bersih: ya');
  log(errs.length ? 'ERR ' + errs.join(' | ') : 'tanpa error JS');
  await browser.close();
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
