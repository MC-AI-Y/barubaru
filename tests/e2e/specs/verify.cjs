const { chromium } = require('playwright');
const { B, log, shot, login, shoot, cards, kpis, state, takeBoth } = require('./_lib.cjs');

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const s = await login(browser, 'cv uji kreasi nusantara', 'Uji12345', { width: 390, height: 844 });
  await s.locator('button[aria-label^="DO"]').click();
  await cards(s).first().waitFor();
  log('KPI awal:', await kpis(s, 'OrdersScreen'));
  log('tab:', (await s.getByRole('tab').allInnerTexts()).join(' | '));
  const regions = await s.getByLabel('Pilih region').locator('option').allInnerTexts();
  log('pilihan region:', regions.join(' | '));
  if (regions.length > 2) {
    const before = (await s.locator('[class*=OrdersScreen_count]').innerText()).split(' ')[0];
    await s.getByLabel('Pilih region').selectOption({ label: regions[1] });
    await s.waitForTimeout(900);
    log('filter region', regions[1], ':', before, '→', (await s.locator('[class*=OrdersScreen_count]').innerText()).split(' ')[0]);
    await s.getByLabel('Pilih region').selectOption({ label: 'Semua region' });
    await s.waitForTimeout(900);
  }
  log('chip status di daftar:', [...new Set(await s.locator('li [class*=OrdersScreen_chips] [class*=chip]').allInnerTexts())].join(','));

  const number = await cards(s).first().locator('[class*=number]').innerText();
  await cards(s).first().click();
  log('galeri tersedia:', await s.getByRole('button', { name: /Galeri/ }).count());
  // Form verifikasi di ATAS detail (sebelum tabel material)
  const formY = (await s.locator('[class*=verifyTop]').boundingBox()).y;
  const tableY = (await s.getByRole('dialog').locator('table').first().boundingBox()).y;
  const evY = (await s.locator('[class*=verifyBottom]').boundingBox()).y;
  log('PIC di atas detail:', formY < tableY, '| Evidence di bawah detail:', evY > tableY);
  log('isi kotak atas:', (await s.locator('[class*=verifyTop] [class*=photoLabel]').allInnerTexts()).join(','), '| kotak bawah:', (await s.locator('[class*=verifyBottom] [class*=photoLabel]').allInnerTexts()).join(','));
  log('chip kartu (perlu verifikasi):', [...new Set(await s.locator('li [class*=chipAction]').allInnerTexts())].join(','));
  await s.getByLabel('Nama PIC', { exact: true }).fill('Budi Penerima');
  await s.getByRole('button', { name: 'Ambil Foto Evidence' }).click();
  log('label kamera evidence:', await s.getByText(/Kamera belakang · watermark otomatis/).count() ? 'Kamera belakang' : 'TIDAK ADA', '| tombol balik:', await s.getByRole('button', { name: /Pindah ke kamera/ }).count());
  await shoot(s);
  await s.getByAltText('Photo Evidence yang akan dikirim').waitFor();
  log('Kirim nonaktif dengan 1 foto:', await s.getByRole('button', { name: 'Kirim Verifikasi' }).isDisabled());
  await s.getByRole('button', { name: 'Ambil Foto PIC' }).click();
  const flip = s.getByRole('button', { name: /Pindah ke kamera/ });
  log('kamera PIC: tombol balik =', await flip.count(), '|', await flip.getAttribute('aria-label'));
  await flip.click();
  await s.waitForTimeout(400);
  log('setelah dibalik:', await s.getByRole('button', { name: /Pindah ke kamera/ }).getAttribute('aria-label'));
  await s.getByRole('button', { name: /Pindah ke kamera/ }).click();
  await shoot(s);
  await s.getByAltText('Photo Evidence PIC yang akan dikirim').waitFor();
  log('Kirim nonaktif sebelum telepon diisi:', await s.getByRole('button', { name: 'Kirim Verifikasi' }).isDisabled());
  await s.getByLabel('Nomor telepon PIC').fill('0812-3456 7890');
  await s.getByLabel('Catatan (opsional)').fill('1 roll kemasan sobek');
  await s.waitForTimeout(300); await s.screenshot({ path: shot('v-preview.png') });
  // Respons pertama "hilang": server sudah memproses, browser tidak menerima.
  let first = true;
  await s.route('**/api/verify', async (route) => { if (first) { first = false; await route.fetch(); await route.abort('connectionreset'); } else await route.continue(); });
  await s.getByRole('button', { name: 'Kirim Verifikasi' }).click();
  await s.locator('[class*=sendError]').waitFor();
  await s.getByRole('button', { name: 'Kirim Verifikasi' }).click();
  await s.getByText(/terkirim\. Status: RECEIVED/).waitFor({ timeout: 15000 });
  await s.waitForFunction(() => { const i = [...document.querySelectorAll('[class*=historyThumb] img')]; return i.length >= 2 && i.every((x) => x.complete && x.naturalWidth > 0); }, null, { timeout: 10000 });
  log('thumbnail riwayat:', await s.locator('[class*=historyThumb] img').count());
  log('foto riwayat tampil: ya | PIC di riwayat:', await s.getByText('PIC: Budi Penerima · 081234567890').count());
  await s.waitForTimeout(400); await s.screenshot({ path: shot('v-sent.png') });

  const orders = await state('/__orders');
  const H = orders.do[1];
  const col = (n) => H.indexOf(n);
  const rows = orders.do.filter((r) => r[col('DO NUMBER')] === number);
  log('sheet DO', number, ':', rows.length, 'baris | Verified =', [...new Set(rows.map((r) => r[col('Verified')]))].join(','), '| PIC Name =', rows[0][col('PIC Name')], '| Photo PIC =', rows[0][col('Photo Evidence PIC')].slice(0, 32) + '…', '| Photo Evidence =', rows[0][col('Photo Evidence')].slice(0, 32) + '…', '| beda:', rows[0][col('Photo Evidence PIC')] !== rows[0][col('Photo Evidence')]);
  let st = await state('/__verify');
  log('catatan Verifikasi (respons hilang tidak ganda):', st.tabs.DO.length - 1, 'baris | PIC:', st.tabs.DO[1][21], st.tabs.DO[1][22], '| judul V/W:', st.tabs.DO[0][21], st.tabs.DO[0][22]);
  const all = (await state('/__state')).files;
  const files = all.filter((f) => f.parents[0] === 'FOLDER_PICDO');
  const evFiles = all.filter((f) => f.parents[0] === 'FOLDER_EVDO');
  log('foto di folder Photo PIC DO:', files.length, files.map((f) => f.name).join(','));
  log('foto di folder Evidence DO:', evFiles.length, evFiles.map((f) => f.name).join(','));
  log('judul X/Y Verifikasi:', st.tabs.DO[0][23], st.tabs.DO[0][24], '| PIC Photo File ID terisi:', Boolean(st.tabs.DO[1][23]));
  await s.getByRole('button', { name: 'Tutup panel' }).click();
  await s.waitForTimeout(800);
  log('KPI setelah kirim:', await kpis(s, 'OrdersScreen'));
  await s.getByRole('tab', { name: 'RECEIVED' }).click();
  await s.waitForTimeout(800);
  log('tab RECEIVED:', (await cards(s).allInnerTexts()).map((t) => t.split('\n').slice(0, 2).join(' ')).join(', '));

  // Validasi server
  const key = number.toLowerCase();
  const post = (meta) => s.request.post(B + '/api/verify', { headers: { Origin: B }, multipart: { file: { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0]) }, meta: JSON.stringify(meta) } });
  const r1 = await post({ kind: 'do', key, verificationId: '99999999-2222-4333-8444-555555555555', picName: 'Budi', picPhone: '12', capture: {} });
  log('telepon tidak valid:', r1.status(), (await r1.json()).error);
  const r2 = await post({ kind: 'do', key, verificationId: '99999999-2222-4333-8444-555555555555', picName: 'Budi', picPhone: '081234567890', source: 'gallery' });
  log('tanpa foto kamera (galeri):', r2.status(), (await r2.json()).error);

  // Admin menolak lewat API → subcont melihat NEED CHECK + alasan, lalu kirim ulang
  const a = await login(browser, 'admin', 'Admin12345', { width: 1366, height: 900 });
  const rej = await a.request.post(B + '/api/admin/decide', { headers: { Origin: B }, data: { kind: 'do', key, verificationId: st.tabs.DO[1][0], decision: 'reject', reason: 'Foto surat jalan buram' } });
  log('admin tolak:', rej.status(), JSON.stringify(await rej.json()));
  await s.getByRole('button', { name: 'Muat ulang' }).click();
  await s.getByRole('tab', { name: 'Perlu verifikasi' }).click();
  await s.waitForTimeout(900);
  const rejCard = cards(s).filter({ hasText: number });
  log('kembali ke Perlu verifikasi, chip:', await rejCard.locator('[class*=chip]').last().innerText());
  await rejCard.click();
  await s.locator('[class*=rejectNote]').waitFor();
  log('catatan tolak:', await s.locator('[class*=rejectNote]').innerText());
  await s.waitForTimeout(300); await s.screenshot({ path: shot('v-rejected.png') });
  await s.getByLabel('Nama PIC', { exact: true }).fill('Sari Penerima');
  await s.getByLabel('Nomor telepon PIC').fill('+62 811 2222 3333');
  await takeBoth(s);
  await s.getByRole('button', { name: 'Kirim Verifikasi' }).click();
  await s.getByText(/terkirim\. Status: RECEIVED/).waitFor({ timeout: 15000 });
  const rows2 = (await state('/__orders')).do.filter((r) => r[col('DO NUMBER')] === number);
  log('kirim ulang → sheet:', rows2[0][col('Verified')], '|', rows2[0][col('PIC Name')]);
  await s.getByRole('button', { name: 'Tutup panel' }).click();

  // TO keluar: tidak ada tombol verifikasi
  await s.getByRole('button', { name: 'Beranda', exact: true }).click();
  await s.locator('button[aria-label^="TO"]').click();
  await s.getByRole('tab', { name: 'Semua' }).click();
  await s.waitForTimeout(800);
  await cards(s).filter({ hasText: 'Keluar' }).first().click();
  await s.getByRole('dialog').locator('table').waitFor();
  log('TO keluar punya tombol verifikasi:', await s.getByRole('button', { name: 'Ambil Foto Evidence' }).count());
  await s.getByRole('button', { name: 'Tutup panel' }).click();

  // Subcont lain tidak bisa membuka foto
  const other = await login(browser, 'cv uji satu', 'Daya4385', { width: 390, height: 844 });
  st = await state('/__verify');
  const vid = st.tabs.DO.at(-1)[0];
  log('subcont lain buka foto:', (await other.request.get(B + `/api/verify/photo?kind=do&id=${vid}`)).status(), '| pemilik:', (await s.request.get(B + `/api/verify/photo?kind=do&id=${vid}`)).status());
  log('error JS:', [...s.errs, ...a.errs, ...other.errs].length ? [...s.errs, ...a.errs, ...other.errs] : 'tidak ada');
  await browser.close();
})().catch((e) => { console.error('GAGAL', e.message); process.exit(1); });
