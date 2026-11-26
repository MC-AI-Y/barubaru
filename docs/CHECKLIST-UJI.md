# Checklist Uji Manual WHControl

Cetak atau salin lembar ini, lalu centang setiap butir.

Isi identitas pengujian:

- Tanggal: ________
- Penguji: ________
- Alamat aplikasi: https://________

| Perangkat | Isi |
|---|---|
| HP 1 (Android + Chrome) | Model: ________ |
| HP 2 (iPhone + Safari) | Model: ________ |
| Tablet | Model: ________ |

Akun uji yang dipakai:

- Akun A (sedikit kota): ________
- Akun B (banyak kota, mis. 22): ________

---

## A. Akses dan login

- [ ] Alamat dibuka dengan **https://** dan logo YOFC tampil tajam
- [ ] Login dengan password **salah** → pesan "Subcont Name atau password salah" (tidak menyebut mana yang salah)
- [ ] Login dengan nama huruf kecil semua + spasi berlebih (mis. `  pt   nama  subcont `) + password benar → **berhasil**
- [ ] Password dengan huruf besar/kecil berbeda → **ditolak**
- [ ] 6× salah berturut-turut → pesan "Terlalu banyak percobaan… Coba lagi dalam 15 menit"
- [ ] Keyboard HP **tidak** mengubah huruf otomatis (autocorrect/kapital) di kolom login
- [ ] Muat ulang halaman setelah login → tetap login
- [ ] Tombol **Keluar** → kembali ke tampilan Login

## B. Selfie awal (PAO)

- [ ] Browser meminta izin **Kamera** dan **Lokasi**
- [ ] Kamera **depan** yang terbuka, tidak ada pilihan galeri
- [ ] Tolak izin lokasi → muncul petunjuk mengaktifkan lokasi, tombol potret tidak bisa ditekan
- [ ] Mode pesawat/tanpa sinyal lalu tekan potret → pesan "waktu resmi dari server diperlukan…", foto tidak tersimpan
- [ ] Selfie tersimpan, tampil tanggal–jam (WIB/WITA/WIT sesuai lokasi) dan alamat
- [ ] Selfie **tanpa watermark**

## B2. Menu Beranda dan peran (v5.0 Tahap 1)

- [ ] Setelah login subcont, Beranda menampilkan "Halo, {nama subcont}", kotak Perlu tindakan, dan 5 kartu: Dashboard, DO, TO, BOQ, Visit.
- [ ] HP: kartu 2 kolom. Laptop: 5 kartu dalam satu baris.
- [ ] Dashboard/DO/TO/BOQ membuka layar "Sedang disiapkan" dengan tombol Kembali ke Beranda.
- [ ] Kartu Visit membuka halaman Visit; Mulai Laporan berjalan seperti v4.7.
- [ ] Ada draf: kotak Perlu tindakan menampilkan "Laporan Visit belum dikirim" dan tombol Lanjutkan Pengisian Form langsung ke langkah terakhir; kartu Visit ber-badge angka.
- [ ] Setelah Selesai mengirim, kembali ke halaman Visit.
- [ ] Login dengan username `admin`: sapaan "Halo, Admin", kartu Visit redup bertanda "Khusus subcont"; membuka Visit menampilkan "Khusus akun subcont".
- [ ] Keluar dari menu Beranda berfungsi untuk subcont dan admin.

## B3. DO, TO, BOQ (v5.0 Tahap 2)

- [ ] Env `SHEET_DO_*`, `SHEET_TO_*`, `SHEET_BOQ_*` sudah diisi di Vercel lalu Redeploy.
- [ ] Beranda subcont menampilkan "N DO/TO/BOQ perlu diverifikasi" dan badge angka di kartu.
- [ ] DO: hanya DO yang tujuannya subcont ini yang tampil; angka KPI masuk akal dibanding sheet.
- [ ] Tab Riwayat (Verified) hanya berisi dokumen yang kolom Verified-nya terisi.
- [ ] Pencarian nomor DO, kota, dan nama material berfungsi.
- [ ] Ketuk kartu: detail menampilkan semua baris material dengan QTY sesuai sheet.
- [ ] TO: TO masuk bertanda **Masuk**; TO keluar bertanda **Keluar · info** dan hanya ada di tab Semua.
- [ ] BOQ: dikelompokkan per PO Number + Site Name; YOFC vs Subcont Qty yang berbeda tampil merah; Link Doc terbuka.
- [ ] Admin: semua dokumen tampil; pilihan subcont menyaring KPI dan daftar.
- [ ] Ubah satu sel Verified di sheet, tekan **Muat ulang**: status berubah.

## B4. Verifikasi subcont (v5.0 Tahap 3)

- [ ] Env `DRIVE_FOLDER_EVIDENCE_DO_ID`, `_TO_ID`, `_BOQ_ID` diisi lalu Redeploy.
- [ ] Subcont: buka DO di tab Perlu verifikasi → Ambil Foto Bukti → kamera belakang terbuka (izinkan kamera dan lokasi).
- [ ] Pratinjau foto + catatan tampil; Kirim Verifikasi → pesan "terkirim. Menunggu persetujuan admin".
- [ ] Dokumen pindah ke tab Menunggu admin; KPI Perlu verifikasi berkurang 1.
- [ ] Di Google Drive (akun WHControl) muncul spreadsheet **WHControl - Verifikasi** dengan 1 baris di tab DO berstatus Menunggu Admin.
- [ ] Foto masuk folder Evidence DO dengan nama sesuai format.
- [ ] Riwayat verifikasi di detail menampilkan foto, waktu, lokasi, catatan.
- [ ] Ubah Status baris itu di spreadsheet Verifikasi menjadi `Ditolak` dan isi Reject Reason, tekan Muat ulang: dokumen kembali ke Perlu verifikasi dengan alasan; kirim ulang berhasil.
- [ ] TO keluar tidak punya tombol Ambil Foto Bukti.
- [ ] Pilih dari Galeri: foto dari galeri HP tampil sebagai pratinjau "Dari galeri" dan terkirim; di spreadsheet Verifikasi kolom Location berisi "Upload dari galeri (tanpa lokasi foto)".
- [ ] Admin: Beranda "1 DO menunggu persetujuan admin"; tab Menunggu admin berisi dokumen tadi dan fotonya bisa dibuka.
- [ ] Subcont lain tidak melihat dokumen dan fotonya.

## B5. Dashboard dan SMDT (v5.0 Tahap 5)

- [ ] Env `SHEET_SMDT_ID` dan `SHEET_SMDT_TAB` (`Stock`) diisi lalu Redeploy; akun WHControl punya akses edit ke file SMDT.
- [ ] Subcont: Dashboard hanya menampilkan Subcont City miliknya; tidak ada tombol Perbarui SMDT. (Sejak v5.3.3 filter Region juga tampil untuk subcont; lihat B13.)
- [ ] Cocokkan 1 baris (mis. satu kota + CABLE-48) dengan hitungan manual dari sheet DO/TO/BOQ yang Verified.
- [ ] Inventory Actual sama dengan Quantity laporan Visit terakhir (satu kota) untuk material itu; GAP = By Data − Actual.
- [ ] Filter (Region, Subcont, City, Material sejak v5.3.3) mengubah grafik dan tabel.
- [ ] Unduh CSV terbuka rapi di Excel.
- [ ] Admin: Perbarui SMDT → pesan jumlah baris; sheet SMDT terisi, judul baris 1–2 tetap, Remarks yang diisi manual tidak hilang.

## B6. Keputusan admin (v5.0 Tahap 4)

- [ ] Admin membuka dokumen Menunggu admin: Setujui nonaktif sampai **Lihat Foto Bukti** ditekan.
- [ ] Setujui → konfirmasi → pesan "Verified. SMDT diperbarui".
- [ ] Sheet DO asli: kolom Verified terisi "Verified" (atau tercentang bila checkbox) di semua baris DO itu, baris lain tidak berubah.
- [ ] Spreadsheet Verifikasi: Status Verified, Reviewed At dan Reviewed By terisi.
- [ ] Dashboard: angka DO kota itu bertambah sesuai QTY.
- [ ] Tolak tanpa alasan tidak bisa; dengan alasan → subcont melihat Ditolak + alasan dan bisa kirim ulang.

## B7. Visit satu kota dan riwayat (v5.0 Tahap 6–7)

- [ ] Tambahkan judul `Subcont City` di sel U1 spreadsheet hasil Visit.
- [ ] Data Gudang: pilihan Kota gudang hanya satu; akun satu kota langsung terpilih; petunjuk Subcont City benar.
- [ ] Kirim laporan Visit: kolom U berisi Subcont City; Dashboard Inventory Actual kota itu memakai laporan ini.
- [ ] Admin: filter tanggal kirim (dari–sampai) di DO/TO/BOQ menyaring dokumen sesuai tanggal verifikasi.

## B13. Revisi v5.3.3 (26 Nov 2026): tanpa kartu KPI, 4 filter

Cek dengan akun admin **dan** akun subcont, di HP dan laptop.

- [ ] Tidak ada kartu KPI (Total In, Total Out, Inventory By Data, Inventory Actual, Total GAP, Material ber-GAP). Dashboard langsung berisi filter, dua grafik, dan tabel detail.
- [ ] Ada 4 filter yang bisa diketik: **Region, Subcont, City, Material**, sama untuk admin dan subcont. Laptop: 4 berjajar; HP: bertumpuk.
- [ ] Subcont: daftar Subcont hanya berisi namanya sendiri; daftar City dan Region hanya miliknya.
- [ ] Admin: pilih Subcont → daftar City hanya kota milik subcont itu. Pilih City tanpa Subcont (mis. JAKARTA) → tabel berisi semua subcont di kota itu.
- [ ] Ganti Region setelah memilih Subcont dari region lain → pilihan Subcont dikosongkan otomatis.
- [ ] Cocokkan City di filter dengan kolom CITY di sheet DO/TO/BOQ untuk satu subcont.

## B12. Revisi v5.3.2 (26 Nov 2026): Dashboard lebih simpel

Cek dengan akun admin **dan** akun subcont, di HP dan laptop.

- [ ] Tidak ada lagi: pilihan "Hitung dari", teks "✓ terverifikasi / belum" di kartu Total In/Out, Peringatan GAP, Visit terakhir, Peringkat Subcont City (admin), dan baris biru "Sudah ikut dihitung tetapi belum diverifikasi".
- [ ] Grafik **In vs Out per material** masih ada.
- [ ] Grafik **Stock by Data vs Stock Visit** menampilkan dua batang per material dan angka GAP di kanan; GAP = Stock by Data − Stock Visit (cocokkan satu material dengan tabel detail).
- [ ] Klik filter City → daftar terbuka; ketik 1 huruf → daftar langsung tersaring; klik salah satu → KPI, grafik, dan tabel berubah. Tombol × mengembalikan ke "Semua".
- [ ] Ketik teks yang tidak ada → "Tidak ada yang cocok"; tekan Esc atau klik di luar → kotak kembali ke pilihan sebelumnya.
- [ ] iPhone: mengetik di filter tidak membuat layar membesar.

## B11. Revisi v5.3.1

- [ ] Kartu DO/TO/BOQ yang perlu diverifikasi subcont punya chip merah **Perlu verifikasi** (admin: **Perlu persetujuan** untuk RECEIVED), di samping chip isi kolom Verified bila ada (mis. ON DELIVERY).
- [ ] Panel detail subcont: kotak PIC (nama, telepon, Foto PIC) paling atas; kotak Evidence (Foto Evidence, status BOQ, catatan, Kirim Verifikasi) paling bawah setelah tabel material.
- [ ] Admin: kotak Keputusan admin di bawah tabel material.

## B10. Revisi v5.3 (26 Nov 2026): nilai kolom Verified

- [ ] (Disarankan) Dropdown kolom Verified diperbarui: DO `ON DELIVERY, RECEIVED, APPROVED, NEED CHECK`; TO `RECEIVED, APPROVED, NEED CHECK`; BOQ `APD, ABD, RFSC, FO CUT/VANDALISME`.
- [ ] DO dengan Verified `ON DELIVERY` tampil di tab Perlu verifikasi dengan chip ON DELIVERY.
- [ ] Subcont kirim DO → pesan "Status: RECEIVED"; sheet Verified = `RECEIVED`; DO pindah ke tab RECEIVED.
- [ ] Admin Setujui → `APPROVED` (+ SMDT diperbarui). Tolak → `NEED CHECK` + alasan; subcont melihatnya kembali di Perlu verifikasi dan bisa kirim ulang.
- [ ] BOQ: form verifikasi punya 4 tombol status; Kirim nonaktif sampai salah satu dipilih. Setelah kirim: sheet Verified = pilihan itu, BOQ pindah ke tab Terverifikasi, pesan "Status: <pilihan>. SMDT diperbarui".
- [ ] Admin BOQ: tidak ada kotak Keputusan admin; tab Belum dikirim subcont / Terverifikasi / Semua.

## B9. Revisi v5.2 (26 Nov 2026): 2 foto verifikasi + notifikasi

- [ ] Sheet DO, TO, dan BOQ punya kolom **`Photo Evidence`** (selain `Photo Evidence PIC`).
- [ ] Env `DRIVE_FOLDER_EVIDENCE_DO_ID`, `_TO_ID`, `_BOQ_ID` **dan** `DRIVE_FOLDER_PIC_DO_ID`, `_TO_ID`, `_BOQ_ID` terisi lalu Redeploy.
- [ ] Subcont buka DO → form verifikasi tampil **paling atas** (sebelum info dokumen dan tabel material).
- [ ] Ambil Foto Evidence → kamera belakang, tanpa tombol balik. Ambil Foto PIC → kamera depan, ada tombol balik ke kamera belakang. Watermark foto PIC memuat baris `PIC: Nama (telepon)`.
- [ ] Kirim Verifikasi nonaktif sampai nama PIC, telepon PIC, foto evidence, dan foto PIC lengkap.
- [ ] Setelah kirim: muncul pesan hijau "… terkirim. Status: WAIT ADMIN" (terlihat di atas panel). Sheet: `Photo Evidence` dan `Photo Evidence PIC` berisi 2 link berbeda; foto ada di folder Evidence DO dan Photo PIC DO.
- [ ] Admin: kartu Keputusan admin di atas detail; tombol **Lihat 2 Foto Bukti** menampilkan kedua foto (laptop: berdampingan); Setujui aktif setelah foto dibuka. Riwayat menampilkan 2 thumbnail.
- [ ] Beranda: "Perlu tindakan" + badge DO/TO/BOQ tampil. Bila satu sheet gagal dibaca (mis. judul kolom salah), muncul baris merah "DO tidak bisa diperiksa" + penyebabnya (bukan hilang diam-diam).
- [ ] Beranda menyegarkan notifikasi saat aplikasi dibuka lagi (pindah tab/HP dinyalakan).

## B8. Revisi v5.1 (26 Nov 2026)

- [ ] Sheet DO dan TO punya kolom `PIC Name` dan `Photo Evidence PIC`; sheet BOQ memakai header format sederhana.
- [ ] Env `DRIVE_FOLDER_PIC_DO_ID`, `_TO_ID`, `_BOQ_ID` diisi (folder Photo PIC DO/TO/BOQ) lalu Redeploy.
- [ ] Subcont buka DO → isi Nama PIC + telepon → Ambil Foto Bukti (tidak ada pilihan galeri) → foto bisa portrait → watermark berisi waktu, lokasi, subcont, Subcont City, dan daftar material.
- [ ] Kirim nonaktif sampai nama dan telepon PIC terisi.
- [ ] Setelah kirim: sheet DO baris-baris dokumen itu berisi PIC Name `Nama (telepon)`, link foto, dan Verified `WAIT ADMIN`; foto ada di folder Photo PIC DO.
- [ ] Chip status di aplikasi sama persis dengan isi kolom Verified (WAIT ADMIN / VERIFIED / REJECTED; BOQ: NEED CHECK / APD / ABD). Dokumen dengan kolom kosong tidak ber-chip.
- [ ] Admin Setujui → `VERIFIED` (BOQ `APD`); Tolak → `REJECTED` (BOQ `ABD`) + alasan tampil ke subcont.
- [ ] Dropdown Region di DO/TO/BOQ menyaring daftar.
- [ ] Dashboard: angka stok sudah termasuk dokumen yang belum diverifikasi. (Teks "✓ terverifikasi / belum" di KPI dan pilihan "Hanya terverifikasi" dihapus di v5.3.2; lihat B12.)
- [ ] Visit: halaman Visit punya tombol Kembali ke Beranda; langkah Material punya tombol Kembali; layar Selesai punya Ke Beranda.

## C. Data Gudang

- [ ] Region hanya berisi kota milik akun (cek dengan akun A dan B)
- [ ] Akun B: 22 kota tampil rapi, bisa dipilih dengan jari
- [ ] Teks "Terpilih:" menampilkan format "Bogor, Depok, dan Cibubur" (2 kota: "A dan B")
- [ ] Tekan Lanjut dengan field kosong → pesan wajib per field
- [ ] Placeholder PIC Subcont = "Nama PIC" (tanpa nomor HP)

## D. Material

- [ ] Tombol **Ambil Foto Material** nonaktif sebelum Material, Remark, Quantity, dan Satuan terisi
- [ ] Pilih material CABLE/kabel apa pun → Satuan otomatis **M** dan terkunci; pilih HDPE → **M**
- [ ] Pilih material lain (POLE, FDT, dll.) → Satuan otomatis **Pcs** dan terkunci (tidak ada dropdown)
- [ ] Ganti material dari CABLE ke FDT → Satuan langsung berubah dari M ke Pcs
- [ ] Ketik Quantity `1200` → tampil **1200** (tanpa titik); titik/koma tidak bisa dimasukkan
- [ ] Watermark dan PDF menampilkan Quantity tanpa pemisah (contoh "1200 M")
- [ ] Spreadsheet kolom N menampilkan **1200** (tanpa titik/koma) dan tetap bisa dijumlah (=SUM)
- [ ] Kamera belakang di Chrome Android: tombol **flash** (ikon petir, kanan atas) menyalakan/mematikan lampu
- [ ] Ketuk layar kamera → muncul kotak kuning dan gambar fokus ke titik itu
- [ ] HP yang tidak mendukung flash: tombol flash tidak tampil, kamera tetap bisa memotret
- [ ] Material FDT/HDPE → Remark otomatis "-" dan tidak bisa diubah
- [ ] Ganti material → pilihan Remark ikut berganti
- [ ] Quantity menerima `12,5` dan `12.5`; menolak `0`, `-1`, `abc`
- [ ] Kamera **belakang** terbuka
- [ ] HP **portrait** → arahan "Putar HP ke mode landscape", tombol potret nonaktif
- [ ] HP **landscape** → bisa memotret
- [ ] Watermark 7 baris terbaca jelas: tanggal & jam, lokasi, Subcont, Warehouse, Material, Remark, Quantity + Satuan
- [ ] Ubah Quantity setelah foto → muncul konfirmasi; **Batal** = data tetap; **Ubah** = foto terhapus
- [ ] Setelah foto material pertama, Data Gudang **terkunci**
- [ ] "Ubah data gudang" → konfirmasi → semua foto material terhapus, data gudang bisa diubah
- [ ] **+ Material** menyimpan dan membuka form baru; ikon **Daftar** menampilkan jumlah
- [ ] Panel Daftar: Edit dan Hapus berfungsi
- [ ] Material dengan nama khusus (`POLE-7M 2,5"`, `HDPE-32/28`) bisa difoto dan disimpan

## E. Draf dan gangguan

- [ ] Tutup tab/browser di tengah pengisian, buka lagi, login → **Lanjutkan Pengisian Form** → data dan foto masih ada
- [ ] Muat ulang halaman → browser memperingatkan sebelum meninggalkan halaman
- [ ] **Buang Draf** → draf hilang setelah konfirmasi
- [ ] Di tengah mengisi Data Gudang atau Material, tekan **logo YOFC** (kiri atas) → kembali ke Beranda; kotak draf menampilkan langkah terakhir
- [ ] Tekan **nama subcont** (kanan atas) → kembali ke Beranda juga
- [ ] Di Beranda tekan **Lanjutkan Pengisian Form** → kembali ke langkah terakhir dengan isian yang sama (termasuk yang baru diketik)
- [ ] Saat layar **Kirim** sedang berjalan, logo dan nama subcont tidak bisa ditekan
- [ ] HP 1: mulai laporan, ambil selfie PAO dan isi nama gudang, tunggu ±5 detik. HP 2 (akun sama): login → Beranda menampilkan **"Ada laporan belum terkirim di perangkat lain"** dengan nama gudang, jumlah material, waktu, dan jenis perangkat
- [ ] HP 1 tidak menampilkan pemberitahuan tentang drafnya sendiri
- [ ] HP 1 kirim laporan sampai selesai → HP 2 muat ulang Beranda → pemberitahuan hilang
- [ ] HP 1 buang draf → HP 2 muat ulang → pemberitahuan hilang
- [ ] HP 2 tekan **Hapus pemberitahuan** → konfirmasi → pemberitahuan hilang (draf di HP 1 tetap ada)

## F. Review dan foto penutup

- [ ] Review menampilkan foto mini, nama, remark, quantity + satuan untuk semua material
- [ ] Edit dari Review → kembali ke form material dengan data terisi → **Simpan Perubahan**
- [ ] Hapus dari Review berfungsi (dengan konfirmasi)
- [ ] Tombol berlabel **"Ambil Foto Penutup & Submit"** → layar **Foto Penutup** membuka **kamera belakang** (tidak tercermin) dan wajib sebelum kirim

## G. Kirim laporan

- [ ] Progress bar berjalan ("Mengunggah foto x/y")
- [ ] Matikan data di tengah unggah → pesan terhenti + tombol **Coba Lagi**; draf aman
- [ ] Nyalakan data → **Coba Lagi** → hanya foto yang belum terunggah yang dikirim → Selesai
- [ ] Layar Selesai: **Unduh PDF** berfungsi; **Selesai** kembali ke Beranda

## H. Hasil di Google Drive dan Sheets

- [ ] Folder Photo Authorized Open/Closed: nama `YYYYMMDD-HHmm_SUBCONT_PAO.jpg` / `_PAC.jpg`
- [ ] Folder Photo Evidence with Watermark: nama `YYYYMMDD_SUBCONT_MATERIAL_NN.jpg`, NN berurutan
- [ ] Folder Formulir Material Stock: PDF `YYYYMMDD-HHmm_SUBCONT_FORM.pdf`
- [ ] Spreadsheet hasil: **1 baris per material**, tidak ada baris ganda walau Coba Lagi ditekan
- [ ] Kolom Region huruf kapital semua ("BOGOR, DEPOK, DAN CIBUBUR")
- [ ] Date/Time/Location per baris mengikuti waktu foto masing-masing
- [ ] Kolom Photo, PAO, PAC, dan Form PDF berisi link yang bisa dibuka
- [ ] Kolom Submitted At (Server) terisi

## I. PDF Form Material Stock

- [ ] Lanskap A4, logo MyRepublic kiri dan YOFC kanan, judul "MATERIAL STOCK"
- [ ] Kata "From" **tidak** tercetak
- [ ] Warehouse Address dan Date dari selfie awal
- [ ] Quantity tampil bersama satuan ("1200 M")
- [ ] Maksimal 25 baris per halaman, header tabel berulang, catatan + nama penanggung jawab di halaman terakhir
- [ ] Tidak ada kolom tanda tangan; nama PIC, SPV, dan PM/RPM tercetak
- [ ] Uji 1 laporan dengan ≥ 30 material → PDF lebih dari 1 halaman, rapi

## J. Tampilan

- [ ] HP lebar kecil (±360 px): tidak ada teks terpotong atau meluber ke samping
- [ ] Tablet dan laptop: tata letak rapi di tengah
- [ ] Nama subcont panjang (mis. "PT KOPERASI PEGAWAI PT. INDOSAT, TBK (KOPINDOSAT)") tampil rapi
- [ ] Semua tombol mudah ditekan dengan jempol

---

Hasil: ☐ Lulus semua  ☐ Ada temuan (tulis di bawah)

Temuan:

1. ________________________________
2. ________________________________
