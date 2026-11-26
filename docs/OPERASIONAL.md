# Catatan Operasional WHControl

Untuk admin internal YOFC yang mengelola WHControl sehari-hari.

---

## 1. Pemegang akun dan akses

| Aset | Pemilik / pemegang | Catatan |
|---|---|---|
| Akun Google khusus WHControl | Admin internal YOFC (isi nama: ____________) | Pemilik folder Warehouse Control dan semua Sheet. Verifikasi 2 langkah **wajib aktif**. Nomor/email pemulihan disimpan di brankas perusahaan, bukan milik satu orang |
| Project Google Cloud (OAuth Client) | Akun Google khusus WHControl | Client Secret hanya ada di Vercel dan `.env.local` admin |
| Repo GitHub `whcontrol` (private) | ____________ | Tambahkan minimal 2 admin agar tidak bergantung pada satu orang |
| Project Vercel | ____________ | Simpan akses login di brankas perusahaan |

**Siapa boleh membuka Sheet "Username and Password":** hanya akun khusus WHControl dan admin yang ditunjuk. Jangan pernah membagikan dengan "Anyone with the link".

---

## 2. Pekerjaan rutin lewat spreadsheet

Perubahan di spreadsheet terbaca aplikasi **paling lambat ±5 menit** kemudian (cache). Tidak perlu deploy ulang.

### Menambah subcont baru

1. Sheet **Username and Password**, tab `Username & Password`: tambahkan baris `Subcont Name | Password`.
   - Subcont Name harus **unik**. Nama ganda dengan password berbeda akan membuat akun itu **tidak bisa login**.
   - Format kolom Password sebaiknya **Plain text** (Format → Number → Plain text) agar angka depan `0` tidak hilang.
2. Sheet **Subcont and City Area**, tab `Subcont & City Control`: tambahkan kota-kota subcont tersebut.
   - Tulis nama subcont **persis sama** (huruf besar/kecil dan spasi berlebih boleh berbeda).
   - Nama subcont boleh hanya di baris pertama kelompok (sel digabung juga boleh), karena sistem mengisi ke bawah otomatis.
   - Tulis kota dengan huruf kapital. Urutan baris = urutan tampil di form dan PDF.

### Menambah material atau remark

Sheet **Material and Remarks**, tab `Sheet1`: tambahkan baris `Material | Remark`.

- Material tanpa pilihan remark: kosongkan kolom Remark (otomatis menjadi `-`).
- Material dengan banyak remark: satu baris per remark, nama material cukup di baris pertama.
- **Satuan otomatis dari nama material:** nama yang memuat `CABLE`, `KABEL`, atau `HDPE` = `M`; selain itu = `Pcs`. Jadi kabel baru cukup diberi nama yang memuat kata CABLE/KABEL agar satuannya M. Kolom `Satuan` di sheet tidak dipakai.

### Mengganti password subcont

Ubah sel Password di Sheet **Username and Password**.

- Dalam ±5 menit, password lama tidak berlaku.
- Sesi yang sedang login dengan password lama **otomatis berakhir**, sehingga subcont harus login ulang.

### Menonaktifkan subcont

Hapus baris subcont di Sheet **Username and Password**. Sesi aktifnya ikut berakhir dalam ±5 menit.

### Kolom Quantity (angka polos)

Quantity disimpan sebagai angka polos tanpa pemisah (`1200`), dan sistem memasang format angka polos pada setiap baris baru. Baris lama yang sempat tampil `1.200` (dari versi sebelumnya): blok kolom N → **Format → Number → Custom number format** → isi `0` → Apply. Nilainya tetap angka, bisa dijumlah dengan `=SUM(N:N)`.

### Jangan diubah

- **Header baris 1 spreadsheet hasil** (20 kolom A–T). Bila diubah, aplikasi **menolak menyimpan laporan** demi mencegah data masuk ke kolom yang salah.
- **Nama tab** di keempat spreadsheet. Bila tab diganti nama, ubah juga variabel `SHEET_*_TAB` di Vercel lalu Redeploy.
- **Kolom tersembunyi/metadata file di Drive.** Sistem memakai "app properties" pada file untuk mencegah unggahan ganda.
- **Folder `WHControl - Status Draf (otomatis, jangan diubah)`** di My Drive akun WHControl. Dibuat otomatis oleh aplikasi untuk pemberitahuan "laporan belum terkirim di perangkat lain". Isinya file kosong tanpa foto. Bila folder ini terhapus, aplikasi membuat ulang folder baru (pemberitahuan lama hilang, laporan tidak terpengaruh).

---

### Phase 2: DO, TO, BOQ, Verifikasi, SMDT

- **Akun admin**: baris dengan Subcont `admin` di sheet Username and Password. Gunakan password kuat dan jangan dibagikan ke subcont.
- **DO/TO/BOQ** diisi admin langsung di Google Sheets. Judul kolom jangan diubah (urutan boleh). Perubahan terbaca ±2 menit, atau segera dengan tombol **Muat ulang** di aplikasi.
- Nama di kolom **WH/SUPPLIER DESTINATION** (DO/TO) dan **Subcont** (BOQ) harus sama dengan nama login subcont, agar dokumen muncul di akun yang benar.
- **Spreadsheet "WHControl - Verifikasi"** dibuat otomatis di My Drive akun WHControl. Jangan mengubah judul kolom atau menghapus baris; ini catatan bukti verifikasi. Bila perlu membatalkan keputusan, ubah kolom Verified di sheet asli dan tulis keterangan di Reject Reason.
- **SMDT → Stock** ditulis ulang otomatis setiap admin menyetujui verifikasi, dan saat tombol **Perbarui SMDT** ditekan. Isi kolom Remarks bebas; selain itu jangan mengedit baris data manual karena akan tertimpa.
- **Spreadsheet hasil Visit**: tambahkan judul `Subcont City` di sel **U1** (sekali saja).
- Folder **Photo PIC DO/TO/BOQ** cukup dibagikan ke akun WHControl dan admin (Restricted).
- **Kolom Verified = status resmi** (v5.3). Disarankan diberi *Data validation → Dropdown* di Google Sheets:
  - DO: `ON DELIVERY, RECEIVED, APPROVED, NEED CHECK`
  - TO: `RECEIVED, APPROVED, NEED CHECK`
  - BOQ: `APD, ABD, RFSC, FO CUT/VANDALISME`

  Arti di aplikasi: kosong / `ON DELIVERY` = subcont perlu verifikasi; `RECEIVED` = subcont sudah kirim 2 foto, menunggu admin; `APPROVED` = admin setuju (terhitung terverifikasi di Dashboard); `NEED CHECK` = admin tolak, subcont kirim ulang. BOQ: subcont memilih salah satu dari 4 pilihan saat verifikasi dan langsung terhitung terverifikasi (tanpa keputusan admin).
  Admin boleh mengubah kolom ini manual; aplikasi selalu mengikuti isinya. Nilai lama (`WAIT ADMIN`, `VERIFIED`, `REJECTED`, `Verified`, centang) masih dikenali. Nilai BOQ lama `NEED CHECK` tampil apa adanya dan BOQ itu bisa diverifikasi ulang oleh subcont.
- Kolom **PIC Name**, **Photo Evidence PIC**, dan **Photo Evidence** (v5.2) diisi aplikasi saat subcont mengirim verifikasi; jangan dihapus judulnya. Bila salah satu tidak ada, kirim verifikasi gagal dengan pesan yang menyebut nama kolomnya.
- Bila Beranda menampilkan baris merah "DO/TO/BOQ tidak bisa diperiksa", baca penyebab di baris itu (biasanya judul kolom atau akses berbagi sheet).

## 3. Rotasi password bila dicurigai bocor

Password disimpan polos (keputusan #9), jadi setiap kecurigaan kebocoran ditangani cepat:

1. **Cabut akses** orang/link yang tidak semestinya: Sheet → **Share** → hapus orang tak dikenal, General access = **Restricted**.
2. **Ganti password** subcont yang terdampak, atau semua subcont bila sumber kebocoran tidak jelas. Sesi lama otomatis tidak berlaku.
3. Bila yang bocor adalah `.env`/Vercel (Client Secret, Refresh Token, JWT_SECRET):
   - Google Cloud → **Clients** → buat **secret baru**, lalu hapus secret lama.
   - Jalankan ulang `npm run google:token -- --write` (lihat bagian 4).
   - Buat `JWT_SECRET` baru. Ini **mengeluarkan semua pengguna** yang sedang login (draf di HP tetap aman).
   - Perbarui ketiga variabel di Vercel, lalu **Redeploy**.
4. Periksa **Vercel → Logs** untuk aktivitas mencurigakan, misalnya banyak percobaan login gagal (rate limit 429).
5. Beri tahu subcont terkait password barunya lewat jalur resmi, bukan grup chat umum.

---

## 4. Refresh token Google perlu dibuat ulang

**Gejala:** login menampilkan "Layanan sedang bermasalah", dan log Vercel memuat `Refresh token tidak valid atau kedaluwarsa`.

**Penyebab umum:**

- akses aplikasi dicabut di <https://myaccount.google.com/permissions>;
- token tidak dipakai 6 bulan;
- aplikasi Gmail biasa masih berstatus **Testing** (token mati setelah 7 hari);
- Client Secret diganti.

**Langkah:**

1. Di komputer admin (folder proyek, `.env.local` berisi Client ID/Secret yang benar):

   ```bash
   npm run google:token -- --write
   npm run google:check
   ```

2. Login dengan **akun khusus WHControl** saat browser terbuka.
3. Salin nilai `GOOGLE_REFRESH_TOKEN` baru dari `.env.local` ke **Vercel → Settings → Environment Variables**, lalu **Redeploy**.

---

## 5. Memindahkan aplikasi ke Vercel Pro atau hosting lain

### Ke Vercel Pro (paling cepat, ±5 menit)

**Settings → Billing → Upgrade to Pro.** Tidak ada perubahan kode maupun env. Pantau **Usage** setelah pindah.

### Ke hosting lain yang mendukung Next.js (mis. Netlify, Render, Railway, VPS dengan Node.js)

1. Hubungkan repo GitHub yang sama ke penyedia baru (atau `git clone` di server).
2. Isi **semua variabel** dari tabel di DEPLOY.md bagian 4.
3. Perintah build: `npm ci && npm run build`. Perintah jalan: `npm run start` (port bawaan 3000, bisa diatur lewat variabel `PORT`).
4. Pastikan **HTTPS aktif** (kamera dan GPS wajib HTTPS).
5. Pastikan batas body request ≥ 5 MB dan batas waktu request ≥ 120 detik untuk `/api/submit`.
6. Folder `src/lib/pdf/assets/` (logo PDF) harus ikut ter-deploy. Di Vercel ini diatur `outputFileTracingIncludes` di `next.config.ts`.
7. Uji dengan checklist di CHECKLIST-UJI.md, lalu arahkan domain ke hosting baru.

Data tidak perlu dipindahkan, karena seluruh data tersimpan di Google Drive/Sheets milik akun WHControl.

---

## 6. Mengganti logo

- **Logo web:** `npm run logo -- "path/Logo YOFC.png"` → file baru di `public/logo/`.
- **Logo PDF:** timpa `src/lib/pdf/assets/yofc-logo.png` atau `myrepublic-logo.png` dengan PNG berlatar putih/transparan yang margin putihnya sudah dipangkas.

Setelah itu commit dan push. Vercel akan deploy otomatis.

---

## 7. Batas yang perlu dipantau

- **Vercel → Usage**, terutama **Fast Origin Transfer** (10 GB/bulan di Hobby). Lihat DEPLOY.md bagian 8.
- **Kuota penyimpanan Google Drive** akun khusus WHControl (15 GB gratis untuk Gmail). Foto ±0,3–1 MB per material. Arsipkan folder foto lama secara berkala bila mendekati penuh.
- **Spreadsheet hasil:** Google Sheets maksimal 10 juta sel, yaitu ±500.000 baris × 20 kolom. Bila mendekati, buat spreadsheet baru (salin header yang sama), lalu ganti `SHEET_RESULT_ID` dan Redeploy.
