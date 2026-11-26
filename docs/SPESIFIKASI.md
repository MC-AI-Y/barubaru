# WHControl: Warehouse Control

Aplikasi web responsif untuk pelaporan stok material gudang subkontraktor YOFC. Setiap laporan dibuktikan dengan foto selfie otomatis (authorized), foto material langsung dari kamera dengan watermark, lalu dihasilkan formulir **Material Stock** dalam bentuk PDF.

> **Status dokumen:** spesifikasi v4.7 (final). Seluruh keputusan sudah dikunci di **bagian 13**. Perubahan dari v3 tercatat di **bagian 15**.

---

## 1. Ringkasan

| Item | Keterangan |
|---|---|
| Nama | **WHControl** (dari *Warehouse Control*) |
| Pengguna | Subkontraktor YOFC (satu akun per Subcont Name) |
| Perangkat utama | HP dan tablet (prioritas), laptop (sekunder) |
| Hosting | Vercel paket Hobby (kode disimpan di GitHub) |
| Penyimpanan file | Google Drive folder **Warehouse Control** (dimiliki akun Google perusahaan khusus WHControl) |
| Penyimpanan data | Google Sheets (hasil input) |
| Output | PDF Form Material Stock, otomatis terisi |

---

## 2. Struktur Google Drive

Folder induk: **Warehouse Control**

| Folder | Fungsi |
|---|---|
| `Database` | Sumber data (baca saja oleh sistem) + spreadsheet hasil input |
| `Photo Authorized Open` | Selfie awal (kode **PAO**) |
| `Photo Authorized Closed` | Foto penutup, kamera belakang (kode **PAC**) |
| `Photo Evidence with Watermark` | Foto material berwatermark |
| `Formulir Material Stock` | Salinan PDF formulir yang dihasilkan sistem |

PDF yang dihasilkan otomatis disimpan di folder `Formulir Material Stock`, dan linknya masuk ke spreadsheet (kolom `Form PDF`).

Folder sistem tambahan (dibuat **otomatis** oleh aplikasi di *My Drive* akun WHControl, **di luar** folder Warehouse Control): `WHControl - Status Draf (otomatis, jangan diubah)`. Isinya file kosong berisi ringkasan draf yang belum terkirim (bagian 8A). Tidak memuat foto. Tidak perlu dibagikan ke siapa pun.

### File di folder `Database`

| File | Kolom | Peran |
|---|---|---|
| Username and Password | Subcont Name, Password | Login |
| Subcont and City Area | Subcont Name, City | Pilihan Region per akun |
| Material and Remarks | Material, Remark | Dropdown Material dan Remark (satuan ditentukan otomatis dari nama material) |
| Template Form Material Stock | (template tata letak) | Acuan layout PDF |
| WHControl (hasil input) | Lihat bagian 7 | Spreadsheet hasil input (Google Sheets asli) |

### Temuan kondisi database (perlu dibereskan sebelum build)

1. **File sumber masih berformat Excel (.xlsx) di Drive**, bukan Google Sheets asli (terlihat dari parameter `rtpof=true` pada link). Google Sheets API tidak bisa membaca file Excel mentah. **Konversi dulu**: buka file lalu *File > Save as Google Sheets*, dan gunakan ID file hasil konversi.
2. **Sel digabung (merged cells)** pada `Material and Remarks` dan `Subcont and City Area`. Nilai hanya tertulis di baris pertama kelompok, baris sisanya kosong. Disarankan diratakan menjadi tabel datar (`Subcont Name | City` dan `Material | Remark`). Sistem tetap mengisi ke bawah (forward-fill) secara otomatis sebagai pengaman.
3. **Duplikat akun:** setiap Subcont Name harus unik. Baris yang benar-benar identik (nama dan password sama) diabaikan oleh sistem. Login yang tidak cocok ditolak.
4. **Material tanpa Remark:** FDT-48, FDT-72, FDT-96, FDT-144, HDPE-32/28, HDPE-40/34 tidak punya pilihan Remark. Remark otomatis `-` (bagian 6).
5. **Typo data:** Remark `USPl` (huruf "l" kecil, kemungkinan maksudnya `USPI`). Kota `KUTAIKERTANEGARA` (ejaan resmi "Kutai Kartanegara") dan `BUKIT TINGGI` (ejaan resmi "Bukittinggi"). Sistem menampilkan apa adanya, tidak memperbaiki diam-diam. Perbaikan dilakukan langsung di sheet sumber bila diinginkan.
6. **Karakter khusus pada nama material**, contoh `POLE-7M 2,5"` (ada koma dan tanda kutip) dan `HDPE-32/28` (ada garis miring). Aman untuk tampilan, tetapi **dibersihkan saat dipakai sebagai nama file** (bagian 5).
7. **Berkas lama:** `RAW HTML Format Data.xlsx` adalah draf awal dan sudah tidak dipakai. Jangan disertakan sebagai acuan.
8. **Password disimpan polos (plain text)** sesuai keputusan, sehingga **akses ke file ini harus sangat ketat**. Link Drive yang dibagikan dengan "anyone with the link" harus dicabut. Lihat bagian 10.

---

## 3. Alur Pengguna

Navigasi berbasis **layar/langkah (step)**, bukan scroll antar halaman. Scroll hanya boleh di dalam satu layar bila isinya panjang (misalnya daftar material).

```
[1 Beranda]  →  [2 Login]  →  [Beranda (sudah login)]
      ↓
[3 Selfie Authorized Open (PAO)]
      ↓
[4 Form Data Gudang]   (Region, WH Name, PIC, SPV, PM/RPM)
      ↓
[5 Form Material]  ⟲  "+ Material" (ulang sebanyak yang dibutuhkan)
      ↓
[6 Ringkasan / Review]  (semua material yang belum disubmit)
      ↓
[7 Foto Authorized Closed (PAC)]
      ↓
[8 Proses Submit]  (upload foto → buat PDF → simpan ke spreadsheet)
      ↓
[9 Selesai]  (unduh PDF, tombol "Selesai" kembali ke Beranda)
```

### Penjelasan tiap langkah

1. **Beranda.** Logo YOFC, nama WHControl, tombol **Login**. Setelah login, halaman yang sama menampilkan nama subcont dan tombol **Mulai Laporan** (nama tombol boleh diganti, misalnya "Mulai Pengecekan Stok"), serta tombol **Keluar**.
2. **Login.** Pengguna **mengetik sendiri** Subcont Name dan Password (tanpa daftar pencarian), diverifikasi ke `Username and Password`. Subcont Name menjadi **kode unik** yang mengikat seluruh data sesi. Aturan pencocokan ada di bagian 10.
3. **Selfie PAO.** Kamera depan, **real-time** (tanpa galeri), **tanpa watermark**. Saat dipotret, sistem mencatat waktu server dan lokasi, yang dipakai untuk **Date** dan **Warehouse Address** pada PDF. Foto disimpan sementara di perangkat dan **baru diunggah saat submit** ke `Photo Authorized Open`. Link-nya masuk ke kolom `Photo Authorized Open` di spreadsheet (tidak tampil di form).
4. **Form Data Gudang.** Diisi sekali per laporan (lihat bagian 4A).
5. **Form Material.** Diisi per material (lihat bagian 4B). Tombol **+ Material** menyimpan material saat ini ke daftar sementara dan membuka form material baru.
6. **Review.** Pengguna melihat seluruh daftar material (foto mini, nama, remark, qty), bisa **mengedit atau menghapus** sebelum submit. Mengedit material mengikuti aturan ambil ulang foto (bagian 4B).
7. **Foto Penutup (PAC).** Wajib sebelum submit. **Kamera belakang**, real-time, **tanpa watermark**. Tombol di layar Review berlabel **"Ambil Foto Penutup & Submit"**, sehingga urutannya jelas: Review → Foto Penutup (PAC) → Submit.
8. **Submit.** Baru pada langkah ini data benar-benar dikirim (lihat bagian 8).
9. **Selesai.** Unduh PDF, lalu tombol **Selesai** kembali ke Beranda. Menutup web langsung juga tidak masalah, selama submit sudah sukses.

**Kembali ke Beranda di tengah pengisian:** di semua layar laporan, menekan **logo YOFC** (kiri atas) atau **nama subcont** (kanan atas) membawa pengguna ke Beranda. Isian yang sudah diketik langsung disimpan di perangkat sebagai draf. Di Beranda tampil kotak **"Ada laporan yang belum dikirim"** (jumlah material, nama gudang, dan langkah terakhir) dengan tombol **"Lanjutkan Pengisian Form"** yang membuka kembali langkah terakhir beserta isiannya. Selama laporan sedang dikirim (langkah Kirim), kedua tombol itu dinonaktifkan agar pengiriman tidak terputus.

---

## 4. Spesifikasi Form

### 4A. Data gudang (sekali per laporan)

| # | Field | Tipe | Aturan |
|---|---|---|---|
| A1 | Region | **Checklist (multi pilih)** | Hanya kota milik akun yang login (dari `Subcont and City Area`). Minimal 1 |
| A2 | Warehouse Name | Teks manual | Wajib |
| A3 | PIC Subcont | Teks manual | Wajib. Berisi **nama PIC saja** (tanpa nomor telepon) |
| A4 | YOFC SPV | Teks manual | Wajib |
| A5 | YOFC PM/RPM | Teks manual | Wajib |

Aplikasi **tidak mengumpulkan nomor telepon PIC** (tidak ada field maupun kolom untuk itu). Pada PDF, baris berlabel **"PIC & Phone Number"** di template diisi nama PIC saja, label template dibiarkan apa adanya.

**Penguncian data gudang:** setelah foto material pertama diambil, **seluruh field data gudang (A1 sampai A5) terkunci**, karena isinya sudah tercetak di watermark foto. Bila tetap perlu diubah, pengguna harus menghapus semua foto material terlebih dahulu (dengan konfirmasi), lalu mengulang foto material.

**Aturan format Region:**

- Pada **form dan PDF**: huruf awal kapital (`BOGOR` menjadi `Bogor`, `PADANG PARIAMAN` menjadi `Padang Pariaman`).
- **Pengecualian singkatan:** singkatan tetap huruf kapital semua (misalnya `DKI JAKARTA` menjadi `DKI Jakarta`, bukan `Dki Jakarta`). Data saat ini (79 kota) belum memuat singkatan. Sistem memakai daftar bawaan (DKI, DIY, NTB, NTT, KAB, dan sejenisnya) untuk data di masa depan.
- Pada **spreadsheet**: **seluruhnya huruf kapital**, termasuk kata "DAN".
- 1 kota: `Bogor` (spreadsheet: `BOGOR`)
- 2 kota: `Bogor dan Depok` (spreadsheet: `BOGOR DAN DEPOK`), tanpa koma
- 3 kota atau lebih: `Bogor, Depok, dan Cibubur` (spreadsheet: `BOGOR, DEPOK, DAN CIBUBUR`), koma antar kota dan "dan" sebelum kota terakhir
- Urutan mengikuti urutan di database.

### Data otomatis (per foto)

Date, Time, dan Location **tidak diisi pengguna dan tidak bisa diubah**. Nilainya diambil **setiap kali foto material diambil**, sehingga tiap baris spreadsheet memuat waktu dan lokasi foto tersebut.

| Data | Keterangan |
|---|---|
| Date | Tanggal saat foto diambil, dari **waktu server** |
| Time | Jam saat foto diambil, dari **waktu server**, dengan label zona (WIB/WITA/WIT) |
| Location | Alamat teks hasil reverse geocoding. Bila alamat tidak didapat, berisi koordinat `lat, long` (lihat bagian 5) |

**Zona waktu:** label WIB/WITA/WIT ditentukan dari **koordinat GPS** foto (batas zona waktu Indonesia), dengan zona waktu perangkat sebagai cadangan. Zona yang sama dipakai untuk kolom Date, Time, dan nama file.

### 4B. Data material (berulang, 1 material = 1 foto = 1 baris spreadsheet)

| # | Field | Tipe | Aturan |
|---|---|---|---|
| B1 | Material | Dropdown (pilih 1) | Sumber `Material and Remarks`. **Semua material tampil untuk semua akun** (tidak difilter per akun). Bebas dipilih berulang |
| B2 | Remark | Dropdown (pilih 1) | Pilihan **menyesuaikan Material** yang dipilih |
| B3 | Quantity | Angka manual | **Angka bulat** lebih dari 0, **tanpa titik, koma, atau pemisah apa pun** (contoh `1200`). Kolom hanya menerima angka |
| B4 | Satuan | **Otomatis** (terkunci) | Terisi otomatis saat material dipilih: **`M`** untuk semua jenis kabel dan HDPE, **`Pcs`** untuk material lainnya. Pengguna tidak perlu memilih atau mengetik |
| B5 | Photo | Kamera langsung | Landscape, berwatermark, tanpa galeri |
| B6 | Notes | Teks manual | **Opsional** (satu-satunya yang boleh kosong) |

**Aturan penting:**

- Satu foto untuk satu material. Dua gulungan kabel yang sama berarti **dua record**, masing-masing dengan foto sendiri.
- **Material tanpa pilihan Remark** (FDT dan HDPE): Remark otomatis **terpilih `-`** (tidak perlu diklik dan tidak bisa kosong).
- **Satuan otomatis:** nama material yang memuat kata **`CABLE`**, **`KABEL`**, atau **`HDPE`** (tidak membedakan huruf besar/kecil) bersatuan **`M`** (meter). Semua material lain bersatuan **`Pcs`**. Satuan tidak bisa diubah pengguna dan divalidasi ulang di server.
- **Penguncian data agar watermark tidak basi:** tombol foto baru aktif setelah Material, Remark, Quantity, dan Satuan terisi. Jika salah satunya diubah **setelah foto diambil**, foto dihapus dan harus diambil ulang (dengan konfirmasi). Data gudang terkunci setelah foto material pertama (bagian 4A).

### 4C. Tombol di form material

- **+ Material**: simpan ke daftar sementara, buka form material baru (tanpa batas jumlah).
- **Review**: menuju layar review. Wajib minimal 1 material.
- Daftar sementara selalu bisa dilihat (misalnya ikon keranjang dengan jumlah, membuka panel dari bawah).

---

## 5. Fitur Utama: Foto Berwatermark

### Aturan umum

- Seluruh foto (selfie PAO, foto material, selfie PAC) **wajib real-time dari kamera**. Tidak ada upload dari galeri.
- **Cara teknis:** gunakan kamera dalam halaman (`getUserMedia`, preview video, lalu ambil frame ke canvas). **Jangan** memakai `<input type="file">`, karena pada sebagian perangkat tetap bisa membuka galeri.
- Selfie PAO memakai kamera depan. Foto penutup PAC dan foto material memakai kamera belakang.
- **Flash dan fokus:** tombol **flash** (lampu kamera menyala terus selama dinyalakan) tampil di pojok kanan atas bila HP/browser mendukungnya. **Ketuk layar untuk fokus** ke titik tertentu (muncul kotak fokus); kamera memakai fokus otomatis terus-menerus bila didukung. Dukungan bergantung perangkat: umumnya tersedia di Chrome Android kamera belakang. Pada perangkat yang tidak mendukung (misalnya sebagian iPhone/Safari), tombol flash tidak ditampilkan dan HP memakai fokus otomatis bawaannya.
- **Watermark hanya untuk foto material.** Selfie PAO dan PAC **tanpa watermark apa pun**.
- Foto material **harus landscape**. Bila perangkat masih portrait, tampilkan arahan "Putar HP ke mode landscape" dan blokir tombol potret sampai landscape.
- Watermark **digambar langsung pada piksel foto** (bukan overlay HTML), sehingga ikut tersimpan.
- Foto dikompres (misalnya sisi panjang maksimal 1600 px, JPEG sekitar 80%) agar ukuran per foto di bawah sekitar 1 MB.
- **Waktu dari server wajib:** saat tombol potret ditekan (foto material maupun selfie), aplikasi meminta waktu resmi ke server. **Tombol potret diblokir sampai server merespons.** Bila tidak ada sinyal, pengguna diminta mencoba lagi. Foto yang sudah diambil tetap aman di perangkat walaupun sinyal putus sesudahnya.

> **Batasan jujur:** web tidak bisa menjamin 100% anti-manipulasi (misalnya GPS palsu). Mitigasinya: waktu resmi dari **server** (jam HP tidak dipakai) dan foto langsung dari kamera. Ini sudah kuat untuk kebutuhan audit biasa.

### Isi watermark foto material (7 baris)

```
[Tanggal dan Waktu]
[Lokasi]
[Subcont Name]
[Warehouse Name]
[Material]
[Remark]
[Quantity dan Satuan]
```

Ditampilkan dalam panel semi-transparan di sudut bawah foto, ukuran huruf proporsional terhadap lebar foto, dan harus terbaca jelas.

**Waktu dan lokasi watermark diambil per foto** (saat tombol potret ditekan), bukan sekali di awal. Dengan begitu setiap bukti mencatat waktu dan tempat yang sebenarnya, walaupun satu laporan memuat banyak material dan diambil berselang waktu.

### Lokasi: alamat otomatis dari GPS (gratis, tanpa kartu kredit)

GPS HP hanya menghasilkan **koordinat** (latitude, longitude, akurasi). Alamat teks didapat lewat *reverse geocoding*, yaitu koordinat dikirim ke layanan peta yang membalas dengan alamat. WHControl memakai layanan gratis berikut dengan urutan **berlapis**:

| Urutan | Layanan | Hasil | Catatan |
|---|---|---|---|
| 1 | **OpenStreetMap Nominatim** | Alamat sampai jalan (tergantung data OSM di daerah itu) | Gratis, tanpa API key. Aturan pemakaian wajar: maksimal 1 request per detik dan identitas aplikasi jelas |
| 2 | **BigDataCloud** (reverse geocode gratis) | Kota/kecamatan, tanpa nama jalan | Cadangan bila Nominatim gagal atau sedang penuh. **Dipanggil dari browser**, karena layanan gratisnya melarang pemanggilan dari server (IP server bisa diblokir). Hasilnya tetap ditandatangani server dengan waktu dari server |
| 3 | **Koordinat GPS perangkat** | `-6.20880, 106.84560` | Pegangan terakhir, selalu tersedia |

**Penyimpanan lokasi:** seluruh hasil lokasi masuk ke **satu kolom `Location`**. Bila alamat berhasil didapat, kolom berisi alamat. Bila tidak, kolom berisi koordinat dengan format `lat, long` (contoh `-6.20880, 106.84560`). **Tidak ada kolom tambahan** untuk Latitude, Longitude, Maps Link, maupun akurasi GPS.

**Aturan pengaman:**

- **Cache per lokasi:** geocode hanya sekali per lokasi. Foto berikutnya yang masih dalam radius sekitar 50 sampai 100 meter memakai alamat yang sama. Cache disimpan di perangkat (per laporan) dan di memori server. Tidak memakai layanan penyimpanan eksternal.
- **Nominatim dipanggil dari server** (API Route Vercel) dengan *User-Agent* dan email kontak yang jelas, sesuai aturan Nominatim. Jangan dipanggil langsung dari browser.
- **Foto tidak pernah gagal karena alamat:** bila ketiga lapis tidak menghasilkan alamat, watermark dan kolom `Location` memakai koordinat.
- Pada watermark: alamat singkat plus koordinat (alamat panjang tidak muat).
- Izin lokasi wajib aktif. Bila ditolak, pengguna tidak bisa lanjut dan diberi petunjuk mengaktifkannya. Web wajib berjalan di HTTPS (Vercel sudah otomatis).
- Di daerah yang datanya jarang di OSM, alamat bisa hanya sampai kecamatan. Ini batasan layanan gratis.
- Kebijakan layanan gratis dapat berubah. Lapisan 2 dan 3 membuat sistem tetap berjalan bila lapisan 1 berubah.

### Penamaan file (disingkat, tanpa koma dan spasi, anti-bentrok)

Koma, spasi, dan tanda kutip pada nama file rawan masalah. Format memakai garis bawah dan **nomor urut** (agar material yang sama tidak bentrok):

| Jenis | Format | Contoh |
|---|---|---|
| PAO | `YYYYMMDD-HHmm_SUBCONT_PAO.jpg` | `20261103-0943_KASIHRAJAWALI_PAO.jpg` |
| PAC | `YYYYMMDD-HHmm_SUBCONT_PAC.jpg` | `20261103-1010_KASIHRAJAWALI_PAC.jpg` |
| Foto material | `YYYYMMDD_SUBCONT_MATERIAL_NN.jpg` | `20261103_KASIHRAJAWALI_CABLE-48_02.jpg` |
| PDF | `YYYYMMDD-HHmm_SUBCONT_FORM.pdf` | `20261103-1010_KASIHRAJAWALI_FORM.pdf` |

Aturan pembersihan (hanya untuk nama file, **tidak mengubah data** di spreadsheet, watermark, maupun login):

- `SUBCONT`: hapus awalan badan usaha (PT/CV), buang semua karakter selain huruf dan angka, huruf kapital semua, maksimal 20 karakter. Contoh `PT Kasih Rajawali` menjadi `KASIHRAJAWALI`.
- `MATERIAL`: tanda kutip `"` menjadi `IN`, koma `,` dan garis miring `/` menjadi `-`, spasi dihapus. Contoh `POLE-7M 2,5"` menjadi `POLE-7M2-5IN`, `HDPE-32/28` menjadi `HDPE-32-28`.
- `NN`: nomor urut material dalam laporan (2 digit).
- Tanggal dan jam pada nama file memakai zona waktu lokasi foto (bagian 4A).

---

## 6. Aturan Validasi

- Semua field wajib terisi, **kecuali Notes**.
- Remark otomatis `-` untuk material yang tidak punya pilihan Remark.
- Quantity: angka bulat lebih dari 0, hanya digit (tanpa titik, koma, spasi, atau desimal). Satuan harus sama dengan satuan otomatis material (`M` atau `Pcs`).
- Region minimal 1 kota, dan hanya kota milik akun (divalidasi di server).
- Material dan Remark harus ada di daftar master (divalidasi di server).
- Minimal 1 material per laporan.
- Setiap material wajib punya foto.
- Selfie PAO wajib sebelum form, foto penutup PAC wajib sebelum submit.
- Data pada form tidak bisa diedit setelah foto diambil, kecuali dengan mengambil ulang foto (bagian 4A dan 4B).
- Tombol potret aktif hanya bila waktu server berhasil didapat (bagian 5).
- Draf yang belum disubmit **tersimpan di perangkat** (IndexedDB) agar tidak hilang bila halaman tertutup atau sinyal putus, dan ada peringatan sebelum meninggalkan halaman.

---

## 7. Skema Spreadsheet Hasil Input

Spreadsheet hasil (**WHControl**) berupa **Google Sheets asli** yang terpisah dari file database sumber. Header di baris 1 dibuat oleh admin, dan sistem hanya menambahkan baris di bawahnya.

Satu baris = satu material. Kolom data gudang (Region, Warehouse Name, PIC, SPV, PM/RPM) **diulang sama** di semua baris dalam satu laporan. Date, Time, dan Location **berbeda per baris** karena mengikuti waktu foto masing-masing.

| Kolom | Nama kolom | Sumber |
|---|---|---|
| A | Submission ID | Otomatis (satu ID per laporan, mengelompokkan baris) |
| B | Subcont Name | Dari login (nama persis seperti di database) |
| C | Photo Authorized Open | Link Drive PAO |
| D | Date | Otomatis, saat foto material diambil (waktu server) |
| E | Time | Otomatis, saat foto material diambil, dengan label WIB/WITA/WIT |
| F | Location | Alamat otomatis, atau koordinat `lat, long` bila alamat tidak didapat |
| G | Region | Checklist, **huruf kapital semua** (`BOGOR, DEPOK, DAN CIBUBUR`) |
| H | Warehouse Name | Manual |
| I | PIC Subcont | Manual (nama PIC) |
| J | YOFC SPV | Manual |
| K | YOFC PM/RPM | Manual |
| L | Material | Dropdown |
| M | Remark | Dropdown (atau `-`) |
| N | Quantity | Manual (angka bulat). Disimpan sebagai **angka polos tanpa pemisah** (`1200`); sistem memasang format angka polos pada baris baru agar tidak mewarisi format lain. Tetap bisa dijumlah |
| O | Satuan | Otomatis: `M` (kabel/HDPE) atau `Pcs` |
| P | Photo | Link Drive foto berwatermark |
| Q | Notes | Manual (opsional) |
| R | Photo Authorized Closed | Link Drive PAC |
| S | Form PDF | Link PDF di `Formulir Material Stock` |
| T | Submitted At (Server) | Cap waktu server saat laporan disimpan (WIB) |

Total **20 kolom (A sampai T)**. Sistem memeriksa bahwa header di baris 1 sesuai daftar ini dan menolak menulis bila tidak cocok, agar data tidak masuk ke kolom yang salah.

---

## 8. Proses Submit dan Penanganan Gagal

1. Validasi seluruh data di perangkat, lalu divalidasi ulang di server.
2. Unggah semua foto (PAO, foto material, PAC) **satu per satu** dengan **progress bar** dan **ulang otomatis** bila gagal (per file).
3. Setelah **semua foto sukses**, server membuat PDF dari data laporan yang dikirim perangkat (bukan dibaca dari spreadsheet), lalu menyimpannya ke `Formulir Material Stock`.
4. Setelah PDF tersimpan, tulis seluruh baris ke spreadsheet **sekaligus** (satu operasi batch), **sudah termasuk link PDF**, sehingga tidak ada laporan setengah tersimpan.
5. Tampilkan layar Selesai.

**Anti-duplikat:** tiap laporan membawa `Submission ID`. Sebelum menulis, server memeriksa apakah Submission ID tersebut sudah ada di spreadsheet. Bila sudah ada (misalnya pengguna menekan ulang atau koneksi terputus lalu dicoba lagi), server tidak menulis ulang dan langsung mengembalikan hasil yang sudah tersimpan, sehingga baris tidak ganda.

**Sinyal buruk:** draf dan foto tetap aman di perangkat. Tombol "Coba Lagi" melanjutkan dari file yang belum terunggah.

### 8A. Pemberitahuan laporan belum terkirim di perangkat lain

Draf dan foto **tetap hanya tersimpan di perangkat pembuatnya** (tidak ikut pindah). Supaya laporan yang menggantung tidak terlupa, server menyimpan **ringkasan** draf:

- Isi ringkasan: Submission ID, nama gudang, jumlah material, waktu dibuat, waktu terakhir diubah, dan jenis perangkat (misalnya "Android · Chrome"). **Tanpa foto** dan tanpa data lain.
- Ringkasan dikirim otomatis dari perangkat saat draf mulai berisi (selfie PAO, nama gudang, atau material), lalu diperbarui bila nama gudang atau jumlah material berubah (paling sering sekali per 20 detik). Bila gagal (sinyal buruk), cukup dicoba lagi pada perubahan berikutnya; tidak mengganggu pengisian.
- Ringkasan **dihapus** saat laporan berhasil disimpan (di server, setelah baris spreadsheet ditulis) dan saat draf dibuang.
- Saat akun yang sama membuka Beranda di **perangkat lain**, muncul kotak **"Ada laporan belum terkirim di perangkat lain"** berisi gudang, jumlah material, waktu, dan jenis perangkat, dengan saran menyelesaikan dan mengirim laporan dari perangkat tersebut.
- Tombol **"Hapus pemberitahuan"** (dengan konfirmasi) untuk laporan yang memang tidak akan dikirim, misalnya HP hilang. Data di perangkat itu tidak ikut terhapus.
- Ringkasan yang tidak diperbarui lebih dari **30 hari** tidak ditampilkan lagi.
- Sesi login tetap **12 jam per perangkat** dan boleh login di beberapa perangkat sekaligus (tidak berubah).

---

## 9. Output: Form Material Stock (PDF)

Mengikuti `Template Form Material Stock`. Tata letak dasar:

- Kertas **A4 lanskap**. Font **Times** (serif standar PDF) sebagai pengganti Cambria, karena Cambria berlisensi dan tidak boleh disertakan di PDF.
- Header: **logo MyRepublic di kiri atas** dan **logo YOFC di kanan atas** (file `Logo YOFC.png` yang dikirim klien, bukan versi "YOFC Indonesia" yang tertanam di template). Judul **"MATERIAL STOCK"** di tengah, ukuran 20, tebal.
- Blok data (Subcontractor sampai PIC & Phone Number) dengan label tebal di kiri.
- Kalimat pernyataan di tengah, tebal.
- Tabel 4 kolom (Material Name, Quantity, Remark, Note) bergaris tipis, header berlatar hijau muda.
- Catatan "Remark:" nomor 1 dan 2 di bawah tabel.

Isian otomatis:

| Posisi template | Diisi dari |
|---|---|
| Subcontractor | Subcont Name |
| Region | Region (format form: `Bogor, Depok, dan Cibubur`) |
| WH Name | Warehouse Name |
| Warehouse Address | Location saat **selfie PAO** |
| Date | Tanggal saat **selfie PAO** (waktu server) |
| PIC & Phone Number | PIC Subcont (nama saja, tanpa nomor telepon) |
| Kalimat pernyataan | Subcont Name, Warehouse Name, Region |
| Tabel: Material Name / Quantity / Remark / Note | Satu baris per material. Kolom Quantity tampil bersama satuan, tanpa pemisah (misalnya "1200 M") |
| Catatan bawah (aturan 1 dan 2) | Teks tetap dari template (dicetak apa adanya) |
| Blok nama penanggung jawab | PIC Subcont, YOFC SPV, YOFC PM/RPM (nama saja) |

Ketentuan PDF:

- Kata **"From"** pada template (`From [Location]`, `From [Date]`, `From [PIC Subcont]`) adalah catatan sumber data dan **tidak dicetak**. Cukup tampil `: <nilai>`.
- Tabel memuat **maksimal 25 baris material per halaman**, sedangkan jumlah material tidak terbatas. PDF **otomatis berlanjut ke halaman berikutnya** (header tabel diulang), dengan catatan bawah dan blok nama penanggung jawab di halaman terakhir. Bila halaman terakhir tidak cukup ruang, keduanya pindah ke halaman baru.
- **Tidak ada tanda tangan.** Sebagai gantinya, di bawah catatan ada blok **nama penanggung jawab** (tanpa garis atau kolom tanda tangan):
  - Subcontractor PIC : [PIC Subcont]
  - YOFC SPV : [YOFC SPV]
  - YOFC PM/RPM : [YOFC PM/RPM]
- Pembuatan PDF dilakukan **dengan menggambar ulang layout template melalui kode** (bukan mengisi file Excel lalu konversi), karena konversi Excel ke PDF tidak tersedia di lingkungan Vercel.
- Logo pada PDF memakai **file asli beresolusi tinggi**.
- Pengguna dapat mengunduh PDF dari layar Selesai. Salinan tersimpan otomatis di Drive.

---

## 10. Arsitektur Teknis

### Stack

- **Next.js** (React, App Router, TypeScript) di Vercel, dengan *API Routes* sebagai backend.
- **Google OAuth dari akun Google perusahaan khusus WHControl** untuk mengakses Drive API dan Sheets API dari backend (lihat penjelasan di bawah).
- Tidak ada kredensial Google yang tampil di sisi browser.
- **Tidak memakai layanan penyimpanan tambahan** (seperti Redis/Upstash). Cache dan pembatasan percobaan login memakai memori server dan perangkat.

### Akses Google: kenapa OAuth akun khusus, bukan Service Account

Service account adalah "akun robot" Google Cloud. Ia mudah dipakai untuk **Sheets**, tetapi **tidak punya kuota penyimpanan Drive**. Bila ia mengunggah foto ke folder My Drive biasa, Google sering menolak dengan error *"Service Accounts do not have storage quota"*. Solusi yang paling sederhana dan stabil untuk kasus ini:

**Backend mengunggah dan menulis atas nama satu akun Google perusahaan yang khusus dipakai WHControl.** Login izin dilakukan **satu kali**, lalu *refresh token* disimpan di Environment Variables Vercel. Seluruh Drive dan Sheet dimiliki akun itu.

| | Jalur A: OAuth akun khusus (dipilih) | Jalur B: Service Account + Shared Drive | Jalur C: Apps Script |
|---|---|---|---|
| Kuota Drive | Memakai kuota akun khusus, aman | Aman, file milik organisasi | Aman (berjalan sebagai pemilik) |
| Syarat | Akun Google Workspace/Gmail | Workspace edisi yang mendukung Shared Drive, dan admin mengizinkan pembuatan key | Akun Google biasa |
| Kecepatan | Cepat | Cepat | Sering lambat (cold start) |
| Keamanan | Token di env Vercel | Key di env Vercel | URL web app publik, perlu token rahasia |
| Risiko gagal | Rendah | Lebih tinggi (sering diblokir kebijakan admin) | Rendah, tetapi batas kuota dan waktu eksekusi |

**Setup Jalur A (ringkas):**

1. Buat project di Google Cloud Console (gratis) **dengan akun khusus WHControl**, aktifkan **Google Drive API** dan **Google Sheets API**.
2. Buat *OAuth Client ID*. Bila akun berupa Google Workspace, set aplikasi sebagai **Internal** (tanpa verifikasi Google dan token tidak mati dalam 7 hari). Bila akun Gmail biasa, aplikasi perlu dipublikasikan agar token tidak kedaluwarsa dalam 7 hari.
3. Lakukan login izin satu kali untuk mendapatkan *refresh token*, lalu simpan di Environment Variables.
4. Pastikan folder **Warehouse Control** dan semua Google Sheet **dimiliki akun khusus ini** (pindahkan atau buat ulang bila sebelumnya milik akun lain).
5. Aktifkan verifikasi 2 langkah dan simpan pemulihan akun (nomor/email cadangan) di tempat yang **tidak bergantung pada satu orang**.

> **Keputusan:** akun Google khusus WHControl dikelola oleh karyawan internal. Jalur OAuth dipakai untuk akun Workspace maupun Gmail biasa, sehingga **jenis akun menyesuaikan saat setup**. Shared Drive tidak diperlukan.

**Catatan batas:** fungsi serverless Vercel memiliki batas ukuran body request sekitar 4,5 MB, sehingga foto harus dikompres (bagian 5) dan diunggah satu per satu, bukan digabung dalam satu request besar.

**Paket Vercel: Hobby (gratis), risiko diterima klien.** Ketentuan Vercel membatasi paket Hobby untuk pemakaian pribadi/non-komersial, sedangkan WHControl dipakai untuk operasional perusahaan. Secara teknis batas Hobby cukup untuk aplikasi ini, tetapi ada **risiko akun ditangguhkan** bila Vercel menilai pemakaiannya komersial. Klien memutuskan tetap memakai Hobby. Mitigasi: kode dan konfigurasi selalu ada di GitHub dan daftar environment variables terdokumentasi, sehingga aplikasi dapat dipindahkan ke paket Pro atau hosting lain dengan cepat bila diperlukan.

### Environment Variables (Vercel)

| Variabel | Isi |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token akun khusus WHControl |
| `DRIVE_ROOT_FOLDER_ID` | ID folder Warehouse Control |
| `DRIVE_FOLDER_PAO_ID` | ID folder Photo Authorized Open |
| `DRIVE_FOLDER_PAC_ID` | ID folder Photo Authorized Closed |
| `DRIVE_FOLDER_EVIDENCE_ID` | ID folder Photo Evidence with Watermark |
| `DRIVE_FOLDER_FORM_ID` | ID folder Formulir Material Stock |
| `SHEET_USERS_ID` | ID Google Sheet Username and Password |
| `SHEET_REGION_ID` | ID Google Sheet Subcont and City Area |
| `SHEET_MATERIAL_ID` | ID Google Sheet Material and Remarks |
| `SHEET_RESULT_ID` | ID Google Sheet hasil input (WHControl) |
| `SHEET_USERS_TAB` | Nama tab sheet Username and Password (saat ini `Username & Password`) |
| `SHEET_REGION_TAB` | Nama tab sheet Subcont and City Area (saat ini `Subcont & City Control`) |
| `SHEET_MATERIAL_TAB` | Nama tab sheet Material and Remarks (saat ini `Sheet1`) |
| `SHEET_RESULT_TAB` | Nama tab spreadsheet hasil input |
| `JWT_SECRET` | Kunci penanda sesi login |
| `GEOCODE_CONTACT_EMAIL` | Email kontak yang dicantumkan pada User-Agent saat memanggil Nominatim |

Semua ID dan nama tab **wajib dibaca dari environment variables**, tidak ditulis permanen di kode. Tidak ada API key berbayar yang dibutuhkan.

### Login, sesi, dan keamanan

**Aturan login:**

- Pengguna **mengetik manual** Subcont Name dan Password. Tidak ada daftar pencarian, sehingga daftar subcont tidak terlihat sebelum login.
- Subcont Name harus cocok dengan database. Pencocokan **tidak membedakan huruf besar/kecil** dan **mengabaikan spasi berlebih** (di awal, di akhir, atau ganda). Password dicocokkan persis (membedakan huruf besar/kecil).
- Bila Subcont Name atau password tidak cocok, login **ditolak**.
- Autocorrect dan huruf kapital otomatis HP dimatikan pada kolom login.
- Pesan gagal bersifat umum ("Subcont Name atau password salah"), tanpa menyebut mana yang salah.

**Keamanan (password disimpan polos sesuai keputusan, sehingga perlindungan ditumpuk di sekitarnya):**

- Verifikasi password **hanya di server**. Isi sheet password tidak pernah dikirim ke browser.
- Sheet password dan folder `Database` **hanya dapat diakses akun khusus WHControl dan admin**. Tidak memakai "anyone with the link". Link lama yang terbuka harus dicabut.
- **Pembatasan percobaan login** (rate limit) di memori server. Karena tidak memakai penyimpanan eksternal, pembatasan ini bersifat *best effort* (berlaku per instance server). Ditambah jeda singkat setiap kali login gagal.
- Password tidak pernah dicatat di log server maupun ditampilkan di pesan error.
- Sesi memakai token bertanda tangan dengan masa berlaku (misalnya 12 jam), disimpan dalam cookie `httpOnly`, dan ada tombol **Keluar**.
- **Region selalu difilter di server** berdasarkan akun login, bukan hanya di tampilan. Material tidak difilter per akun, tetapi divalidasi terhadap daftar master.
- Data database dibaca dengan **cache singkat** (misalnya 5 sampai 10 menit) supaya perubahan data di Drive tetap terbawa tanpa memperlambat aplikasi.
- **JANGAN meng-commit ke GitHub:** folder `Database` beserta isinya (ada password asli), semua kredensial Google (Client Secret, Refresh Token), dan file `.env`. Gunakan `.gitignore`.

> Catatan risiko: karena password polos, kebocoran akses ke sheet berarti seluruh password terbuka. Itu sebabnya akses sheet dibatasi ketat dan password di-rotasi (diganti) bila ada kecurigaan kebocoran.

---

## 11. Ketentuan Tampilan (UI/UX)

- Tema **terang, profesional, korporat**, dengan animasi halus dan elegan. Hindari tampilan polos.
- Palet mengambil dari logo YOFC (pink, oranye, hijau, biru) sebagai aksen pada dasar putih/abu terang.
- **Prioritas HP dan tablet** (mobile-first), layout tetap rapi di laptop.
- Perpindahan antar langkah memakai transisi layar, **bukan scroll halaman**. Tampilkan indikator langkah (stepper) di atas.
- Tombol besar, nyaman disentuh, kontras jelas.
- Peringatan dan pesan error berbahasa Indonesia yang ramah.
- Bahasa antarmuka: Indonesia (istilah teknis dan nama kolom tetap Inggris sesuai database).

### Logo

`Logo YOFC.png` (1920×1080, sekitar 1,6 MB, bertuliskan "Smart Link Better Life.") adalah **sumber utama** untuk web maupun PDF. Logo **MyRepublic** (file resolusi tinggi dari klien) hanya dipakai di **header PDF** (kiri atas), tidak tampil di web.

- **PDF:** memakai file asli beresolusi tinggi (YOFC dan MyRepublic). Margin putih dipangkas agar proporsional di header.
- **Web:** memakai **versi hasil pengecilan** dari file yang sama (margin putih dipangkas, lebar sekitar 300 sampai 400 px, format WebP/PNG ringan) yang disimpan di `public/logo/`. File 1,6 MB **tidak boleh dimuat apa adanya** di browser.

---

## 12. Struktur Proyek (GitHub)

```
whcontrol/
├── README.md
├── .gitignore                 # wajib mengecualikan .env dan folder database
├── .env.example               # contoh variabel tanpa nilai rahasia
├── package.json
├── public/
│   └── logo/                  # logo YOFC (sudah dioptimasi)
├── src/
│   ├── app/                   # halaman/layar (login, mulai, form, review, selesai)
│   │   └── api/               # login, data referensi, waktu server, geocode, upload foto, submit
│   ├── components/            # kamera, watermark, stepper, daftar material, dsb.
│   ├── lib/
│   │   ├── google/            # klien Drive dan Sheets
│   │   ├── auth/              # sesi, rate limit
│   │   ├── format/            # format Region, nama file, tanggal, zona waktu
│   │   └── pdf/               # pembuat PDF Form Material Stock
│   └── styles/
└── docs/                      # spesifikasi dan skema kolom
```

---

## 13. Keputusan (Final)

| # | Topik | Keputusan |
|---|---|---|
| 1 | Nomor telepon PIC | **Tidak ada.** `PIC Subcont` hanya berisi nama PIC. Label template PDF dibiarkan apa adanya |
| 2 | Satuan Quantity | Otomatis: `M` untuk semua jenis kabel dan HDPE, `Pcs` untuk lainnya. Quantity berupa angka bulat tanpa pemisah apa pun *(direvisi di v4.5 dan v4.6)* |
| 3 | Waktu watermark | **Per foto** (tanggal, jam, dan lokasi saat foto diambil) |
| 4 | Layanan alamat GPS | OSM Nominatim, lalu BigDataCloud, lalu koordinat GPS perangkat. Tanpa Google dan tanpa kartu kredit |
| 5 | Material tanpa Remark (FDT, HDPE) | Remark otomatis terpilih `-` |
| 6 | Area tanda tangan di PDF | **Tidak ada** tanda tangan. Diganti blok **nama penanggung jawab** (PIC Subcont, YOFC SPV, YOFC PM/RPM) tanpa kolom tanda tangan *(direvisi di v4 dan v4.1)* |
| 7 | Kata "From" pada template PDF | Tidak dicetak |
| 8 | Backend | Vercel API Routes dengan Google OAuth dari akun perusahaan khusus WHControl |
| 9 | Password | Tetap polos, dengan perlindungan akses ketat (bagian 10) |
| 10 | Logo | File jernih dipakai di PDF, versi kecil hasil pengecilan untuk web |
| 11 | Format Region | Form dan PDF: `A, B, dan C` (huruf awal kapital, singkatan tetap kapital). Spreadsheet: huruf kapital semua |
| 12 | Login | Mengetik manual dan harus benar (tanpa daftar pencarian), dengan toleransi huruf besar/kecil dan spasi berlebih pada Subcont Name. Tidak cocok berarti ditolak |
| 13 | Akun Google | Akun khusus WHControl yang dikelola karyawan internal. OAuth dipakai untuk Workspace maupun Gmail, jenis akun menyesuaikan saat setup |
| 14 | Paket Vercel | **Hobby (gratis)**, dengan risiko penangguhan akun yang diterima klien (bagian 10) |
| 15 | Kolom lokasi | Semua hasil lokasi masuk ke kolom **Location** (alamat, atau `lat, long` bila alamat tidak didapat). Tanpa kolom Latitude/Longitude/Maps Link/akurasi |
| 16 | Skema spreadsheet hasil | 20 kolom A sampai T sesuai bagian 7, header dibuat admin |
| 17 | Urutan submit | Upload foto, lalu buat PDF, lalu tulis semua baris sekaligus beserta link PDF |
| 18 | Penguncian data gudang | Seluruh field data gudang terkunci setelah foto material pertama |
| 19 | Filter per akun | Hanya Region. Material tampil lengkap untuk semua akun |
| 20 | Zona waktu | Ditentukan dari koordinat GPS, cadangan zona perangkat |
| 21 | Waktu server | Tombol potret diblokir sampai server merespons |
| 22 | Foto PAO dan PAC | Tanpa watermark. PAO kamera depan, PAC kamera belakang. PAO diunggah saat submit *(direvisi di v4.5)* |
| 23 | Penamaan file | Format singkat bagian 5 (contoh `KASIHRAJAWALI`). Hanya untuk nama file, data asli tidak berubah |
| 24 | Penyimpanan tambahan | Tidak memakai Upstash/Redis atau layanan eksternal lain. Rate limit dan cache *best effort* di memori |
| 25 | Logo PDF | MyRepublic di kiri atas, YOFC (`Logo YOFC.png`) di kanan atas. Web hanya logo YOFC |
| 26 | Baris tabel PDF | Maksimal 25 baris material per halaman |
| 27 | Kertas PDF | A4 lanskap, font Times (pengganti Cambria) |
| 28 | Lapis 2 geocode | BigDataCloud dipanggil dari browser (aturan layanan gratis), hasil ditandatangani server |
| 29 | Draf lintas perangkat | Hanya pemberitahuan (ringkasan tanpa foto). Draf dan foto tidak dipindahkan antar perangkat |
| 30 | Sesi per perangkat | 12 jam, boleh aktif di beberapa perangkat sekaligus |
| 31 | Flash dan fokus kamera | Tombol flash (torch) dan ketuk-untuk-fokus, tampil hanya bila didukung perangkat |
| 32 | Kembali ke Beranda | Logo YOFC dan nama subcont di header membuka Beranda; draf dilanjutkan lewat tombol "Lanjutkan Pengisian Form" |

---

## 14. Di Luar Lingkup (Opsional Tahap Berikutnya)

- Dasbor admin YOFC (rekap laporan per subcont/region).
- Pengingat laporan pada tanggal 1 dan 15 setiap bulan (sesuai aturan template).
- Mode offline penuh (PWA dengan antrean unggah otomatis).
- Notifikasi email ke SPV/PM saat laporan masuk.

---

## 15. Riwayat Revisi

### v5.3.3 (26 November 2026): Dashboard tanpa kartu KPI, 4 filter

Berlaku sama untuk admin dan subcont (dokumen pemilik "Phase 2_3", REVISI MINOR poin 1 dan 8).

- **Keenam kartu KPI dihapus** (Total In, Total Out, Inventory By Data, Inventory Actual, Total GAP, Material ber-GAP). Isi Dashboard: filter → grafik In vs Out per material dan grafik Stock by Data vs Stock Visit (+ angka GAP) → tabel detail.
- **Filter menjadi 4 dropdown yang bisa diketik: Region, Subcont, City, Material** (sebelumnya Region, Subcont City, Material). Admin dan subcont mendapat keempatnya; akun subcont hanya melihat pilihan dari datanya sendiri (akses data di server tidak berubah).
  - Saling menyaring: Region mempersempit Subcont, City, dan Material; Subcont mempersempit City dan Material; City mempersempit Material. Pilihan yang tidak ada lagi setelah filter di atasnya berubah dikosongkan otomatis.
  - City boleh dipilih tanpa Subcont (mis. semua subcont di JAKARTA).
- **Data baru di setiap baris stok: `city`.** Diambil dari kolom kota di sheet: `CITY/SUPPLIER NAME DESTINATION` (DO, TO masuk), `CITY/SUPPLIER NAME ORIGIN` (TO keluar), `City` (BOQ). Bila kosong, City dibentuk dari Subcont City dikurangi nama subcont (Q3), mis. "HARSO JAKARTA" − "HARSO" = "JAKARTA". Sheet tidak perlu diubah.

### v5.3.2 (26 November 2026): revisi minor Dashboard (lebih simpel)

Berlaku untuk admin dan subcont.

- **Dihapus:** pilihan **Hitung dari** (Semua dokumen / Hanya terverifikasi), teks "✓ terverifikasi / belum" di kartu Total In dan Total Out, panel **Peringatan GAP**, panel **Visit terakhir** (termasuk catatan admin tentang laporan Visit beberapa kota), tabel **Peringkat Subcont City**, dan baris biru "Sudah ikut dihitung tetapi belum diverifikasi".
- **Angka stok selalu dihitung dari semua dokumen** (termasuk yang belum diverifikasi, revisi 8 v5.1). Bagian terverifikasi tetap ditandai ✓ di tabel detail dan tersedia di kolom CSV "In/Out Terverifikasi".
- **Data vs Aktual** diganti **Stock by Data vs Stock Visit** per material: dua batang (Stock by Data, Stock Visit) dan **angka GAP** di kanan (GAP = Stock by Data − Stock Visit; positif "kurang di gudang", negatif "lebih di gudang", 0 "sesuai"). Grafik **In vs Out per material** tetap.
- **Filter Region, Subcont City, dan Material** menjadi dropdown yang bisa diketik (komponen `SearchSelect`): daftar tersaring sejak 1 huruf tanpa membedakan huruf besar/kecil, huruf yang cocok ditebalkan, pilihan tetap bisa diklik, tombol × menghapus pilihan, keyboard ↑ ↓ Enter Esc. Subcont tetap tanpa filter Region.
- Urutan halaman: filter → 6 kartu KPI → grafik In vs Out dan Stock by Data vs Stock Visit (berdampingan di laptop) → tabel detail.
- API `/api/dashboard` tidak berubah (data `visits`, `pending`, `ranking` masih dikirim tetapi tidak ditampilkan).

### v5.3.1 (26 November 2026): chip "Perlu verifikasi" dan posisi foto

- **Chip di kartu & detail kembali seperti versi awal:** merah **Perlu verifikasi** (subcont) / **Perlu persetujuan** (admin) untuk dokumen yang menunggu tindakan akun itu; oranye **Belum diverifikasi** untuk dokumen kosong yang bukan giliran akun itu; **Sebagian terverifikasi** bila hanya sebagian baris disetujui. Isi kolom Verified (ON DELIVERY, RECEIVED, APPROVED, NEED CHECK, pilihan BOQ) tetap tampil sebagai chip tersendiri.
- **Posisi form:** kotak **PIC** (nama, telepon, Foto PIC) di **paling atas** panel detail; kotak **Evidence** (Foto Evidence, pilihan status BOQ, catatan, tombol Kirim Verifikasi) di **paling bawah**, setelah tabel material. Kotak **Keputusan admin** kembali di bawah detail.

### v5.3 (26 November 2026): nilai kolom Verified baru

- **DO**: kosong / `ON DELIVERY` (barang dalam pengiriman, subcont perlu verifikasi) → subcont kirim 2 foto → `RECEIVED` (menunggu admin) → admin **Setujui** = `APPROVED`, **Tolak** = `NEED CHECK` (subcont kirim ulang).
- **TO**: kosong → `RECEIVED` → `APPROVED` / `NEED CHECK` (sama seperti DO, tanpa ON DELIVERY).
- **BOQ**: subcont **memilih** salah satu `APD`, `ABD`, `RFSC`, `FO CUT/VANDALISME` saat mengirim verifikasi (wajib, tombol pilihan di form). Nilai itu langsung ditulis ke kolom Verified dan BOQ dianggap **terverifikasi**; **tidak ada keputusan admin** untuk BOQ (admin hanya melihat; API keputusan menolak BOQ). SMDT ditulis ulang setelah BOQ terkirim.
- Tab DO/TO: subcont `Perlu verifikasi | RECEIVED | APPROVED | Semua`; admin `RECEIVED | Belum dikirim subcont | APPROVED | Semua`. Tab BOQ: subcont `Perlu verifikasi | Terverifikasi | Semua`; admin `Belum dikirim subcont | Terverifikasi | Semua`. KPI "Verified" berganti nama "Terverifikasi".
- Chip `ON DELIVERY` tampil di daftar DO. Riwayat BOQ menampilkan pilihan subcont.
- Kompatibel dengan data lama: `WAIT ADMIN` = menunggu admin, `VERIFIED`/`Verified`/centang = disetujui, `REJECTED` = ditolak. BOQ lama `NEED CHECK` ditampilkan apa adanya dan bisa diverifikasi ulang.
- Perbaikan: panel detail tidak lagi terbuka sendiri bila ditutup sebelum data selesai dimuat ulang setelah kirim.

### v5.2 (26 November 2026): 2 foto verifikasi, form di atas, notifikasi

- **Verifikasi = 2 foto kamera berwatermark** per pengiriman (DO/TO/BOQ):
  1. **Photo Evidence**: surat jalan atau barang saat tiba, kamera belakang → folder **Evidence DO/TO/BOQ** (env `DRIVE_FOLDER_EVIDENCE_DO_ID`, `_TO_ID`, `_BOQ_ID`), link ke kolom **`Photo Evidence`**. Nama file `YYYYMMDD-HHmm_DO-<NOMOR>_<SUBCONT>.jpg`.
  2. **Photo Evidence PIC**: orang yang meminta verifikasi, **kamera depan (bisa dibalik ke belakang)** → folder **Photo PIC DO/TO/BOQ** (env `DRIVE_FOLDER_PIC_*_ID`), link ke kolom `Photo Evidence PIC`. Nama file sama + `_PIC`. Watermark sama seperti evidence ditambah baris `PIC: Nama (telepon)`.
  - Kirim aktif hanya bila nama PIC, telepon PIC, dan kedua foto lengkap. Kedua foto diunggah sekaligus; kirim ulang setelah sinyal putus tidak membuat foto/baris ganda.
  - Kolom baru di sheet DO, TO, BOQ: **`Photo Evidence`** (nama lain yang diterima: `Photo Evidence DO/TO/BOQ`, `Evidence`, `Foto Evidence`). Wajib ada saat aplikasi menulis verifikasi.
  - Spreadsheet Verifikasi: kolom baru X–Y `PIC Photo File ID`, `PIC Photo Link` (judul ditambahkan otomatis).
- **Penempatan:** form verifikasi subcont dan kartu Keputusan admin dipindah **ke paling atas panel detail**, terpisah dari baris Verified dan tabel material. Detail menampilkan tautan Photo Evidence dan Photo Evidence PIC bila terisi.
- **Admin:** tombol **Lihat 2 Foto Bukti** membuka kedua foto (HP: geser; laptop: berdampingan). Riwayat verifikasi menampilkan 2 thumbnail.
- **Notifikasi:**
  - Pesan (toast) kini tampil **di atas** panel detail, dialog, dan foto (sebelumnya tertutup panel sehingga "terkirim" tidak terlihat). Gagal kirim/setujui juga memunculkan pesan merah.
  - "Perlu tindakan" di Beranda menampilkan baris merah bila sheet DO/TO/BOQ gagal dibaca (dengan penyebab, mis. judul kolom tidak sesuai), atau "Coba lagi" bila server tidak terjangkau. Sebelumnya notifikasi dan badge hilang diam-diam.
  - Beranda memuat ulang jumlah notifikasi saat aplikasi dibuka kembali.

### v5.1 (26 November 2026): revisi DO, TO, BOQ, Dashboard, navigasi

- **Verifikasi dokumen:** 1 foto untuk seluruh DO/TO/BOQ (mis. surat jalan atau barang saat tiba), **wajib langsung dari kamera** (galeri dihapus lagi), ditambah **nama dan nomor telepon PIC penerima** (wajib, telepon 8–15 angka). Foto boleh portrait atau landscape.
- **Watermark** foto bukti memakai format Visit: Tanggal & Waktu, Lokasi, Subcont Name, Warehouse Name (= Subcont City tujuan / Subcont City BOQ), lalu satu baris per material `<Material> · Remark: - · <Quantity Satuan>` (contoh `CABLE-48 · Remark: - · 1200 M`). Maksimal 8 baris material; sisanya `+N material lainnya`.
- **Kolom baru di sheet DO/TO/BOQ:** `PIC Name` (diisi aplikasi: `Nama (telepon)`) dan `Photo Evidence PIC` (link foto). Foto disimpan di folder **Photo PIC DO / Photo PIC TO / Photo PIC BOQ** (env `DRIVE_FOLDER_PIC_DO_ID`, `_TO_ID`, `_BOQ_ID`; nama env lama `DRIVE_FOLDER_EVIDENCE_*` masih diterima sebagai cadangan).
- **Status hanya dari database (kolom Verified):**
  - DO/TO: kosong → `WAIT ADMIN` (subcont mengirim) → `VERIFIED` (admin setuju) / `REJECTED` (admin tolak; subcont boleh kirim ulang).
  - BOQ: kosong → `NEED CHECK` → `APD` (setuju) / `ABD` (tolak).
  - Aplikasi menulis nilai ini ke semua baris dokumen dan menampilkan isi kolom apa adanya (chip status, tab). Nilai lain yang diketik admin ditampilkan apa adanya dan dianggap belum diverifikasi. Nilai lama `Verified`/centang tetap dianggap disetujui.
  - Spreadsheet "WHControl - Verifikasi" tetap dipakai sebagai riwayat (foto, PIC, lokasi, alasan tolak), tidak lagi menentukan status. Kolom baru V–W: PIC Name, PIC Phone (judul ditambahkan otomatis).
- **BOQ format sederhana:** PIC Name, Photo Evidence PIC, Site Name, Subcont, City, Subcont City, Region, Site Type, Status, Material Name, QTY, Verified. Satu dokumen BOQ = **Site Name + Subcont City** (tidak ada PO Number). QTY dijumlahkan ke kolom BOQ di Dashboard.
- **Dropdown Region** di menu DO, TO, dan BOQ (subcont dan admin), berisi region dari dokumen milik akun.
- **Dashboard:** stok bertambah dari **semua** DO/TO/BOQ walau belum diverifikasi. KPI Total In/Total Out menampilkan bagian **terverifikasi** dan **belum**; pilihan **Hitung dari: Semua dokumen / Hanya terverifikasi**; tabel menandai bagian terverifikasi (✓); CSV mendapat kolom In/Out Terverifikasi. SMDT ditulis dari semua dokumen.
- **Navigasi:** tombol **Kembali ke Beranda** di halaman Visit, **Kembali** di langkah Material, **Ke Beranda** di layar Selesai (selain logo/nama di header).

### v5.0.1 (24 November 2026): foto bukti dari galeri

- Verifikasi DO/TO/BOQ oleh subcont kini boleh memakai **foto dari galeri** selain kamera (tombol **Ambil Foto Bukti** atau **Pilih dari Galeri**). Tetap 1 foto per pengiriman. Visit tetap wajib kamera langsung.
- Gambar galeri (JPG/PNG/WebP, HEIC bila didukung browser) diubah di perangkat menjadi JPEG maks 1600 px sebelum dikirim.
- Foto dari kamera tetap mencatat waktu dan lokasi resmi. Foto galeri dicatat dengan waktu kirim server dan kolom Location "Upload dari galeri (tanpa lokasi foto)", sehingga admin tahu sumbernya. Nama file mengikuti format yang sama.

### v5.0 Tahap 7 (23 November 2026): riwayat dan pengamanan

- Riwayat admin: tab Riwayat/Semua dengan filter subcont, **tanggal kirim (dari–sampai, WIB)**, status (tab), dan nomor dokumen (pencarian).
- Batas laju: kirim verifikasi maks 30 per 10 menit per subcont; keputusan admin maks 120 per 10 menit.
- Unduh CSV Dashboard aman dari teks yang terbaca sebagai rumus Excel.
- Semua teks pengguna (catatan, alasan, Remarks) ditulis ke Sheets sebagai teks (RAW), tidak pernah sebagai rumus.

### v5.0 Tahap 6 (23 November 2026): Visit satu Subcont City

- Data Gudang: pilihan **Kota gudang** (satu kota) menggantikan checklist banyak kota (Q17). Akun dengan satu kota langsung terpilih. Petunjuk menampilkan Subcont City, mis. "CV TOSKA SOLUSI KREATIF MANADO".
- Draf lama yang memilih beberapa kota diminta memilih satu kota sebelum lanjut.
- Spreadsheet hasil Visit kini 21 kolom: kolom **U = Subcont City** (Subcont + spasi + City, huruf kapital). Kolom A–T tidak bergeser; pengecekan judul tetap A–T. Admin cukup menambahkan judul "Subcont City" di U1 (aplikasi tetap membaca kolom U walau judulnya belum ada).
- Dashboard memakai kolom U untuk Inventory Actual; laporan lama tanpa kolom U tetap dipakai bila Region-nya satu kota.

### v5.0 Tahap 4 (23 November 2026): keputusan admin

- Di detail dokumen berstatus Menunggu admin, admin menekan **Lihat Foto Bukti** (foto layar penuh). Tombol **Setujui** baru aktif setelah foto dibuka.
- **Setujui** (dengan konfirmasi): kolom **Verified** di sheet DO/TO/BOQ asli diisi untuk semua baris material dokumen itu: teks "Verified", atau centang bila kolomnya checkbox (Q6). Baris dicari ulang dari data terbaru berdasarkan kunci dokumen, bukan nomor baris lama. Catatan di spreadsheet Verifikasi menjadi Verified (Reviewed At/By terisi). Sheet SMDT langsung ditulis ulang; bila gagal, persetujuan tetap berlaku dan admin diminta menekan Perbarui SMDT.
- **Tolak** wajib dengan alasan (3–300 karakter): catatan menjadi Ditolak beserta alasan; dokumen kembali ke subcont.
- Keputusan ganda dicegah: bila verifikasi sudah berubah (dikirim ulang atau sudah diputuskan), server menolak dan meminta Muat ulang.

### v5.0 Tahap 5 (23 November 2026): Dashboard dan SMDT

- Menu **Dashboard** aktif. Server membaca DO, TO, BOQ, riwayat verifikasi, dan hasil Visit, lalu menghitung kolom SMDT per Subcont City + material: DO, Borrow, TOTAL In, BOQ, Handover, Total Use/Out, Inventory By Data, Inventory Actual, GAP (rumus bagian 4.1).
- "Verified" = baris bertanda Verified di sheet asli, atau dokumen yang disetujui admin di aplikasi (Tahap 4). Dokumen yang belum Verified tidak dihitung dan ditampilkan sebagai "Belum masuk hitungan".
- **Inventory Actual** = laporan Visit terakhir per Subcont City (jumlah Quantity per material). Sebelum Tahap 6 (kolom U Subcont City), Subcont City dibentuk dari Subcont + City untuk laporan yang Region-nya **satu kota**; laporan beberapa kota belum dipakai dan dihitung sebagai catatan untuk admin.
- Tampilan: filter (Region khusus admin, Subcont City, Material), 6 KPI (Total In, Total Out, Inventory By Data, Inventory Actual, Total GAP, Material ber-GAP), Peringatan GAP (8 terbesar; positif = kurang di gudang), Visit terakhir, grafik **In vs Out** dan **Data vs Aktual** per material, Peringkat Subcont City (admin: GAP dan verifikasi tertunda), tabel detail yang bisa diurutkan, dicari, disaring "hanya ber-GAP", dan diunduh CSV.
- Subcont hanya melihat Subcont City miliknya; admin melihat semua.
- **Perbarui SMDT** (khusus admin): menulis ulang sheet SMDT → Stock mulai baris setelah judul (judul di baris 1–2 tidak diubah), hanya baris yang punya data, kolom **Remarks** dipertahankan berdasarkan Subcont City + Material Name.
- Env baru: `SHEET_SMDT_ID`, `SHEET_SMDT_TAB`.

### v5.0 Tahap 3 (23 November 2026): verifikasi oleh subcont

- Di detail DO/TO/BOQ yang perlu diverifikasi, subcont menekan **Ambil Foto Bukti**: kamera belakang, langsung dari kamera (tanpa galeri), tanpa watermark, 1 foto. Waktu dan lokasi resmi dari server ikut dicatat (sama seperti Visit). Catatan opsional maks 500 karakter, lalu **Kirim Verifikasi**.
- Foto disimpan ke folder **Evidence DO/TO/BOQ** dengan nama `YYYYMMDD-HHmm_DO-<NOMOR>_<SUBCONT>.jpg` (BOQ: `..._BOQ-<PO>_<SITE>_<SUBCONT>.jpg`).
- Setiap pengiriman dicatat sebagai satu baris di spreadsheet **WHControl - Verifikasi** (dibuat otomatis di My Drive akun WHControl, tab DO/TO/BOQ, 21 kolom: Verification ID, Doc Key, Doc Number, Site Name, Subcont, Subcont City, Status, Submitted At, Submitted By, Location, Photo File ID, Photo File Name, Notes, Material Count, Total Qty, Reviewed At, Reviewed By, Reject Reason, Submitted Epoch, Reviewed Epoch, Photo Link). Sheet DO/TO/BOQ asli tidak diubah.
- Status dokumen: kolom Verified di sheet asli menentukan **Verified**; bila belum, status diambil dari baris terakhir di spreadsheet Verifikasi: **Menunggu Admin** atau **Ditolak** (dengan alasan; subcont bisa kirim ulang).
- Tab subcont: Perlu verifikasi / Menunggu admin / Riwayat (Verified) / Semua. Tab admin: Menunggu admin / Belum dikirim subcont / Riwayat / Semua. Pilihan subcont untuk admin diurutkan dari yang paling banyak menunggu admin.
- Detail dokumen menampilkan **Riwayat verifikasi** beserta foto (ketuk untuk memperbesar). Foto diambil lewat server: admin melihat semua, subcont hanya miliknya; folder Evidence boleh Restricted.
- Pengaman: kirim ulang setelah koneksi putus tidak membuat data ganda; dokumen yang sedang menunggu admin atau sudah Verified tidak bisa dikirim lagi; TO keluar hanya informasi; admin tidak bisa mengirim verifikasi; foto bukti wajib diambil paling lama 30 menit sebelum dikirim.
- Beranda admin: "N DO/TO/BOQ menunggu persetujuan admin".
- Env baru: `DRIVE_FOLDER_EVIDENCE_DO_ID`, `DRIVE_FOLDER_EVIDENCE_TO_ID`, `DRIVE_FOLDER_EVIDENCE_BOQ_ID`; opsional `SHEET_VERIFY_ID`.

### v5.0 Tahap 2 (23 November 2026): daftar DO, TO, BOQ

- Menu **DO**, **TO**, dan **BOQ** aktif: membaca sheet Delivery Order, Transfer Order, dan BOQ (cache 2 menit, tombol **Muat ulang** mengambil data terbaru).
- Kolom dicari berdasarkan **nama judul** (urutan bebas; baris judul boleh di baris 1–10). Judul DO/TO mengikuti spesifikasi Phase 2: DO NUMBER/TO NUMBER, WH/SUPPLIER ORIGIN, CITY/SUPPLIER NAME ORIGIN, WH NAME/SUPPLIER CITY ORIGIN, WH/SUPPLIER DESTINATION, CITY/SUPPLIER NAME DESTINATION, WH NAME/SUPPLIER CITY DESTINATION, REGION, MATERIAL NAME, QTY, Verified. BOQ: kolom Subcont City dan Detail boleh tidak ada (Subcont City dibentuk dari Subcont + spasi + City).
- Bila judul kolom tidak sesuai atau env belum diisi, layar menampilkan pesan yang menyebut kolom/variabel yang bermasalah.
- **Siapa melihat apa:** DO = subcont tujuan; TO = subcont tujuan (Masuk, memverifikasi) dan subcont asal (Keluar, informasi); BOQ = subcont pemilik; admin melihat semua dan bisa memilih subcont (diurutkan dari yang paling banyak perlu verifikasi).
- Setiap layar: 4 KPI (Total dokumen, Perlu verifikasi, Verified, Total QTY / Subcont Qty), tab **Perlu verifikasi / Riwayat (Verified) / Semua**, pencarian, daftar kartu 20 per halaman (terbaru dulu), dan detail per dokumen (semua baris material; BOQ menandai selisih YOFC Qty vs Subcont Qty dan tombol Link Doc).
- Satu dokumen = satu nomor DO/TO, atau PO Number + Site Name + Subcont City untuk BOQ. Dokumen dianggap Verified bila semua barisnya Verified; bila baru sebagian, tampil **Sebagian Verified**.
- Kolom Verified dianggap terisi bila berisi teks **Verified** atau centang (TRUE). Remark BOQ TRUE/FALSE tampil sebagai Ya/Tidak. QTY menerima 1200, 1.200, atau 1,200.
- Beranda: kotak Perlu tindakan dan badge kartu menampilkan jumlah DO/TO/BOQ yang perlu diverifikasi.
- Env baru: `SHEET_DO_ID`/`SHEET_DO_TAB`, `SHEET_TO_ID`/`SHEET_TO_TAB`, `SHEET_BOQ_ID`/`SHEET_BOQ_TAB`.

### v5.0 Tahap 1 (23 November 2026): kerangka Phase 2

- **Beranda setelah login menjadi menu 5 fitur** sesuai urutan spesifikasi Phase 2: Dashboard, DO, TO, BOQ, Visit. Ada sapaan, kotak **Perlu tindakan** (draf Visit dan laporan Visit di perangkat lain; nanti juga jumlah DO/TO/BOQ yang menunggu), dan badge angka di kartu Visit.
- **Visit** = alur laporan v4.7 tanpa perubahan. Halaman awal Visit memuat pemberitahuan perangkat lain, ringkasan draf, Mulai Laporan / Lanjutkan Pengisian Form, dan Buang Draf. Tombol Keluar pindah ke menu Beranda. Selesai mengirim kembali ke halaman Visit.
- **Peran admin:** akun dengan username `admin` (tidak membedakan huruf besar/kecil) di sheet Username and Password dikenali sebagai admin. Peran dihitung server dari nama akun; cookie sesi tidak berubah sehingga pengguna yang sedang login tidak perlu login ulang.
- **Visit khusus subcont:** kartu Visit untuk admin bertanda "Khusus subcont", dan semua API Visit (wilayah, material, konteks foto, unggah, kirim, PDF, status draf) membalas 403 untuk admin.
- Dashboard, DO, TO, BOQ tampil sebagai "Sedang disiapkan" sampai Tahap 2–5.
- Label login menjadi **Subcont**; pesan gagal menjadi "Subcont atau password salah".

### v4.7 (16 November 2026)

- **Kembali ke Beranda** lewat logo YOFC (kiri atas) atau nama subcont (kanan atas) di tengah pengisian. Isian langsung disimpan sebagai draf.
- Tombol di Beranda menjadi **"Lanjutkan Pengisian Form"**, dan kotak draf menampilkan langkah terakhir.

### v4.6 (16 November 2026)

- **Satuan** selalu otomatis dan terkunci: `M` untuk semua jenis kabel (nama memuat `CABLE`/`KABEL`) dan HDPE, `Pcs` untuk lainnya. Dropdown satuan dan kolom opsional `Satuan` di sheet tidak dipakai lagi.
- **Quantity** ditulis angka saja tanpa titik/koma di form, watermark, PDF, dan spreadsheet (`1200`). Menggantikan format titik ribuan v4.5.
- **Kamera:** tombol flash dan ketuk layar untuk fokus (bila didukung perangkat).

### v4.5 (9 November 2026)

- **Foto penutup (PAC)** memakai **kamera belakang** (sebelumnya kamera depan). Label layar menjadi "Foto Penutup".
- **Satuan otomatis:** dari kolom opsional `Satuan` di sheet `Material and Remarks`, atau bawaan (POLE = pcs, CABLE = M). Material lain memakai dropdown satuan dengan pilihan "Lainnya (ketik sendiri)". Revisi keputusan #2.
- **Quantity** menjadi bilangan bulat (tanpa desimal) dengan titik pemisah ribuan otomatis di form, watermark, PDF, dan spreadsheet (`1.200`). Di spreadsheet tetap tersimpan sebagai angka.

### v4.4 (6 November 2026)

- **Pemberitahuan laporan belum terkirim di perangkat lain** (bagian 8A): ringkasan draf tanpa foto disimpan di folder sistem pada My Drive akun WHControl, ditampilkan di Beranda perangkat lain, dihapus otomatis saat laporan terkirim atau draf dibuang.
- **Halaman login** ditata ulang: logo dan form di tengah layar (HP dan laptop).

### v4.3 (4 November 2026)

- **BigDataCloud** dipanggil dari browser (layanan gratisnya melarang pemanggilan dari server).
- **Font PDF:** Times menggantikan Cambria (lisensi). Footer setiap halaman PDF memuat nomor halaman dan Submission ID untuk audit.

### v4.2 (4 November 2026)

- **Environment Variables:** ditambah nama tab per spreadsheet (`SHEET_USERS_TAB`, `SHEET_REGION_TAB`, `SHEET_MATERIAL_TAB`, `SHEET_RESULT_TAB`) agar tidak ditulis permanen di kode.

### v4.1 (4 November 2026)

- **Logo PDF:** MyRepublic di kiri atas, YOFC (`Logo YOFC.png`) di kanan atas.
- **Tabel PDF:** maksimal 25 baris material per halaman (sebelumnya 29).
- **Penanggung jawab:** PDF menampilkan nama PIC Subcont, YOFC SPV, dan YOFC PM/RPM tanpa tanda tangan.
- Tata letak template dirinci (A4 lanskap, Cambria, header tabel hijau muda).
- Temuan data kota: `KUTAIKERTANEGARA` dan `BUKIT TINGGI` ditampilkan apa adanya. Belum ada singkatan di data kota.

### v4 (4 November 2026)

- **Lokasi:** kolom Latitude, Longitude, Maps Link, dan akurasi GPS dihapus. Semua hasil lokasi masuk ke kolom `Location` (alamat, atau `lat, long`).
- **Skema spreadsheet hasil** ditetapkan 20 kolom (A sampai T), header dibuat admin.
- **Urutan submit:** PDF dibuat sebelum baris ditulis, sehingga link PDF ikut dalam satu operasi batch.
- **Penguncian:** seluruh field data gudang terkunci setelah foto material pertama (sebelumnya hanya disebut Warehouse Name).
- **Filter per akun:** hanya Region. Material tidak difilter per akun.
- **Login:** Subcont Name atau password tidak cocok berarti ditolak. Baris identik di database diabaikan.
- **Zona waktu** WIB/WITA/WIT ditentukan dari koordinat GPS.
- **Waktu server wajib:** tombol potret diblokir sampai server merespons.
- **Selfie PAO dan PAC tanpa watermark.** PAO diunggah saat submit (bukan saat selfie).
- **Blok tanda tangan PDF dihapus** (revisi keputusan #6).
- **Penamaan file:** aturan pembersihan SUBCONT dan MATERIAL diperjelas, ditambah format nama file PDF.
- **Format Region:** pengecualian singkatan tetap huruf kapital.
- **Tanpa layanan penyimpanan eksternal** (Upstash/Redis tidak dipakai).
