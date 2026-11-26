# Tahap 7: Temuan Pengujian dan Perbaikannya

Pengujian dilakukan dengan tiga cara:

- **79 unit test**, dijalankan dengan `npm test`.
- **Uji end-to-end otomatis di browser** (Chromium, kamera dan GPS tiruan) terhadap server API WHControl yang terhubung ke Google tiruan.
- **Uji PDF** dengan 3, 25, 70, dan 100 material.

## A. Temuan dan perbaikan

| # | Temuan | Dampak | Perbaikan |
|---|---|---|---|
| 1 | Draf disimpan 250 ms setelah perubahan. Bila tab ditutup tepat setelah "+ Material", material terakhir bisa hilang | Data hilang | Perubahan penting (foto, daftar material, bukti unggah) **langsung** disimpan. Ketikan tetap ditunda. Ditambah simpan paksa saat `pagehide`/`visibilitychange` |
| 2 | "Kembali" dari Data Gudang yang dibuka dari Review malah ke Selfie Awal | Navigasi membingungkan | Riwayat layar: Kembali selalu ke layar yang benar-benar dibuka sebelumnya |
| 3 | Toast "Silakan isi material berikutnya" muncul saat menekan Review | Pesan menyesatkan | Toast hanya untuk "+ Material" |
| 4 | Warna teks samar `#7B8698` hanya 3,7:1 di atas putih | Sulit dibaca, gagal WCAG AA | Diganti `#667085` (4,8:1). Seluruh token warna lain sudah ≥ 4,5:1 |
| 5 | Tombol Edit/Hapus 40 px, tombol tutup toast 32 px | Sulit ditekan | Dinaikkan menjadi 44 px dan 40 px |
| 6 | Browser dalam aplikasi (Instagram/Facebook/LINE) dan browser tanpa dukungan kamera memberi pesan umum | Pengguna bingung | Pesan khusus: "Buka di Chrome/Safari, bukan dari dalam aplikasi chat/media sosial" |
| 7 | Saat pengiriman terhenti, label progres masih "Mengunggah…" | Menyesatkan | Label menjadi "Pengiriman terhenti" + tombol Coba Lagi |
| 8 | Layanan gratis BigDataCloud **melarang** pemanggilan dari server (IP server bisa diblokir) | Lapis 2 geocode bisa mati | Lapis 2 dipanggil dari **browser**. Hasilnya tetap ditandatangani server dengan waktu dari tiket server |
| 9 | Penulisan baris ke Sheets yang diulang otomatis bisa menggandakan baris bila respons pertama hilang | Baris ganda | Append **tidak** diulang otomatis. Kirim ulang selalu dicek dulu lewat Submission ID |
| 10 | Teks pengguna yang diawali `=` bisa menjadi rumus di Sheets | Injeksi rumus | Semua baris ditulis dengan `valueInputOption=RAW` (teruji) |
| 11 | Karakter di luar huruf Latin (emoji, ✓) membuat PDF gagal dibuat | Submit gagal | Karakter yang tidak didukung font PDF diganti "?" |
| 12 | Dengan tinggi baris awal, 70 material menjadi 4 halaman | Tidak sesuai kriteria | Tinggi baris disesuaikan: 70 material = **3 halaman**, 100 material = 5 halaman (4 halaman tabel + halaman catatan) |

## B. Kasus tepi yang diuji (lulus)

| Kasus | Hasil |
|---|---|
| Izin kamera ditolak / browser tanpa dukungan kamera | Kartu petunjuk + "Coba Lagi". Tidak pernah membuka galeri |
| Izin lokasi ditolak | Tombol potret nonaktif + petunjuk mengaktifkan lokasi |
| Tanpa sinyal saat memotret | Potret diblokir: "waktu resmi dari server diperlukan" (keputusan #21) |
| HP portrait saat foto material | Arahan "Putar HP ke mode landscape", tombol nonaktif. Setelah diputar, aktif |
| Putus koneksi setelah 20 dari 102 foto terunggah | Pesan terhenti. Draf + 20 bukti unggah tersimpan |
| Tab ditutup di tengah pengiriman, dibuka lagi | "Lanjutkan Laporan". Hanya 82 foto sisanya yang diunggah, **0 file ganda** di Drive |
| Respons penyimpanan hilang (server sudah menulis) | Kirim ulang otomatis dikenali → "Laporan ini sudah tersimpan sebelumnya", **0 baris ganda** |
| Sesi berakhir di tengah laporan | Kembali ke Beranda dengan pesan. Setelah login lagi, draf masih ada |
| Material berkarakter khusus `POLE-7M 2,5"`, `HDPE-32/28` | Nama file `POLE-7M2-5IN`, `HDPE-32-28`. Data asli tidak berubah |
| Subcont dengan 22 kota | Semua kota tampil sebagai chip yang mudah disentuh |
| Nama subcont panjang "PT KOPERASI PEGAWAI PT. INDOSAT, TBK (KOPINDOSAT)" | Tampil rapi di 360 px. Kode file `KOPERASIPEGAWAIPTIND` (20 karakter) |
| 100 material dalam satu laporan | Review tampil dalam ±60 ms, 102 foto terunggah (3 paralel), 100 baris, PDF 5 halaman |
| Foto/waktu/lokasi diubah di perangkat | Ditolak server (tanda tangan tidak cocok) |
| Kota di luar akun / remark tidak sesuai material | Ditolak server (validasi ulang) |
| Header spreadsheet hasil diubah | Penyimpanan ditolak tanpa menulis apa pun. Admin diberi tahu lewat log |

## C. Pemeriksaan keamanan (readme bagian 10)

| Butir | Status |
|---|---|
| Password hanya diverifikasi di server, tidak pernah dikirim ke browser | ✔ |
| Password tidak masuk log (diuji: log server tidak memuat password) | ✔ |
| Rate limit: 5 gagal per nama, 20 per IP / 15 menit + jeda acak | ✔ (best effort per instance, keputusan #24) |
| Cookie sesi `httpOnly`, `SameSite=Lax`, `Secure` di produksi, 12 jam | ✔ (`document.cookie` kosong) |
| Sesi berakhir otomatis bila password diganti atau akun dihapus | ✔ |
| Region difilter di server; material/remark divalidasi di server | ✔ |
| Endpoint tanpa sesi → 401; permintaan lintas situs → 403 | ✔ |
| Tidak ada rahasia di bundle klien (dicek: 0 kemunculan nama env/HMAC di JS klien) | ✔ |
| Waktu & lokasi foto ditandatangani server; bukti unggah ditandatangani | ✔ |
| Unduh PDF hanya untuk pemilik laporan (dicek lewat metadata file Drive) | ✔ |
| Header keamanan: nosniff, X-Frame-Options DENY, Permissions-Policy kamera/lokasi hanya situs sendiri | ✔ |

## D. Performa di HP kelas menengah

| Butir | Nilai |
|---|---|
| JavaScript klien (minified, termasuk React) | ±266 KB (±84 KB gzip) |
| Foto | Sisi panjang maks 1600 px, JPEG 80% (turun bertahap bila > 1 MB) |
| Gambar mini daftar/review | 320 px, disimpan terpisah, sehingga 100 material tidak memuat 100 foto besar |
| Memori kanvas | Kanvas dilepas (`width = 0`) setelah setiap foto |
| Unggah | 3 file paralel, ulang otomatis 3× per file (1 s, 3 s, 6 s) |
| Draf | IndexedDB, plus permintaan `navigator.storage.persist()` agar tidak dihapus browser |

## E. Aksesibilitas dasar

- Kontras teks ≥ 4,5:1 (diukur untuk semua pasangan warna utama).
- Target sentuh ≥ 44 px untuk tombol aksi, chip kota, dan input. Tombol utama 52 px.
- Semua input berlabel. Pesan galat terhubung ke input (`aria-describedby`) dan diumumkan (`role="alert"`).
- Stepper memakai `aria-current="step"`. Dialog memakai `role="alertdialog"`/`aria-modal`, dan tombol Esc menutup.
- Fokus pindah ke judul setiap layar baru. Animasi dimatikan bila perangkat meminta *reduced motion*.

## F. Belum bisa diuji dari lingkungan pengembangan (wajib diuji klien)

- **HP nyata** (kamera asli, GPS asli, iPhone Safari). Gunakan [CHECKLIST-UJI.md](CHECKLIST-UJI.md).
- **Google Drive/Sheets asli dan OpenStreetMap Nominatim asli.** Gunakan `npm run google:check` lalu satu laporan uji.
- **`npm run build` Next.js.** Kode sudah diperiksa tipe dan dibundel, tetapi build Next resmi berjalan di komputer admin/Vercel.

## G. Keputusan saat permintaan tahap berbeda dengan readme

Sesuai aturan "readme menang":

| Permintaan tahap | Yang diterapkan (readme v4.x) |
|---|---|
| Simpan Latitude, Longitude, Maps Link, akurasi sebagai kolom | Hanya kolom **Location** (alamat, atau `lat, long`) — keputusan #15. Koordinat dan akurasi tetap ada di draf untuk watermark |
| Jam perangkat, waktu resmi dicatat saat submit | Waktu resmi **server saat tombol potret ditekan**. Jam perangkat hanya ditampilkan di kamera — keputusan #21 |
| Placeholder PIC "Nama - No. HP" | "Nama PIC" (tanpa nomor HP) — keputusan #1 |
| 21 kolom spreadsheet | **20 kolom A–T** — keputusan #16 |
| PDF dibuat setelah baris ditulis, lalu kolom Form PDF diisi | PDF dibuat dulu, lalu semua baris ditulis sekali beserta link PDF — keputusan #17 |
| Blok tanda tangan Subcontractor & SPV/PM | Tanpa tanda tangan; blok **nama penanggung jawab** — keputusan #6 |
| Logo YOFC saja di header PDF | MyRepublic kiri + YOFC kanan — keputusan #25 |
| Halaman uji kamera terpisah | Diuji langsung di alur nyata (Selfie Awal / Material). Tidak ada halaman tambahan |
