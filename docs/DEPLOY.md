# Panduan Deploy WHControl ke Vercel (paket Hobby)

Panduan langkah demi langkah dari nol sampai aplikasi bisa dipakai di HP lewat HTTPS.
Perkiraan waktu: 45–60 menit (sebagian besar untuk setup Google).

> **Rahasia** (Client Secret, Refresh Token, JWT_SECRET, password) hanya diketik di `.env.local` komputer admin dan di dashboard Vercel.
> Jangan dikirim lewat chat atau email, dan jangan di-commit ke GitHub.

---

## 0. Yang perlu disiapkan

| Kebutuhan | Keterangan |
|---|---|
| Akun Google khusus WHControl | Pemilik folder **Warehouse Control** dan semua spreadsheet |
| Akun GitHub | Tempat menyimpan kode (repo **private**) |
| Akun Vercel | Daftar di <https://vercel.com> dengan akun GitHub, pilih paket **Hobby** |
| Node.js 20.9+ di komputer admin | Untuk membuat refresh token dan menguji lokal (<https://nodejs.org>, pilih LTS) |

## 1. Siapkan Google Drive dan Sheets

Ikuti **[docs/SETUP-GOOGLE.md](SETUP-GOOGLE.md)** langkah 0–6, yaitu:

1. Konversi 3 file database (.xlsx) ke Google Sheets asli dan catat ID barunya.
2. Pastikan spreadsheet hasil **WHControl** punya header 20 kolom persis seperti berikut (baris 1, kolom A–T):

   ```
   Submission ID | Subcont Name | Photo Authorized Open | Date | Time | Location | Region | Warehouse Name | PIC Subcont | YOFC SPV | YOFC PM/RPM | Material | Remark | Quantity | Satuan | Photo | Notes | Photo Authorized Closed | Form PDF | Submitted At (Server)
   ```

3. Buat project Google Cloud, aktifkan Drive API dan Sheets API, atur layar izin OAuth (**Internal** untuk Workspace; **External + Publish app / In production** untuk Gmail biasa), lalu buat OAuth Client tipe **Desktop app**.
4. Jalankan `npm install` lalu `npm run google:token -- --write` untuk mendapatkan refresh token.
5. Lengkapi `.env.local`, lalu jalankan `npm run google:check`. **Semua baris harus ✔** sebelum lanjut.

## 2. Unggah kode ke GitHub

1. Di GitHub: **New repository**, beri nama `whcontrol`, pilih **Private**, jangan centang README.
2. Di komputer, dari folder proyek:

   ```bash
   git init
   git add .
   git status            # pastikan TIDAK ada .env.local, file .xlsx, atau folder Database
   git commit -m "WHControl"
   git branch -M main
   git remote add origin https://github.com/<akun>/whcontrol.git
   git push -u origin main
   ```

   File `.gitignore` sudah mengecualikan `.env*` (kecuali `.env.example`), `*.xlsx`, folder `Database`, dan file kredensial.

## 3. Buat project di Vercel

1. Buka <https://vercel.com/new>, pilih **Import** pada repo `whcontrol` (izinkan Vercel mengakses repo bila diminta).
2. **Framework Preset:** Next.js (otomatis). Root Directory: `./`. Build Command dan Output: biarkan bawaan.
3. **Jangan klik Deploy dulu.** Buka bagian **Environment Variables** (langkah 4).

## 4. Isi SEMUA Environment Variables

Isi variabel berikut (salin nilainya dari `.env.local`).
Untuk tiap variabel, centang environment **Production** dan **Preview**. **Development** hanya perlu dicentang bila memakai `vercel dev`.

| Variabel | Contoh / keterangan | Rahasia? |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | – |
| `GOOGLE_CLIENT_SECRET` | dari Google Cloud | **Ya** |
| `GOOGLE_REFRESH_TOKEN` | dari `npm run google:token` | **Ya** |
| `DRIVE_ROOT_FOLDER_ID` | ID folder Warehouse Control | – |
| `DRIVE_FOLDER_PAO_ID` | ID folder Photo Authorized Open | – |
| `DRIVE_FOLDER_PAC_ID` | ID folder Photo Authorized Closed | – |
| `DRIVE_FOLDER_EVIDENCE_ID` | ID folder Photo Evidence with Watermark | – |
| `DRIVE_FOLDER_FORM_ID` | ID folder Formulir Material Stock | – |
| `SHEET_USERS_ID` | ID Google Sheet Username and Password | – |
| `SHEET_USERS_TAB` | `Username & Password` | – |
| `SHEET_REGION_ID` | ID Google Sheet Subcont and City Area | – |
| `SHEET_REGION_TAB` | `Subcont & City Control` | – |
| `SHEET_MATERIAL_ID` | ID Google Sheet Material and Remarks | – |
| `SHEET_MATERIAL_TAB` | `Sheet1` | – |
| `SHEET_RESULT_ID` | ID spreadsheet hasil WHControl | – |
| `SHEET_RESULT_TAB` | nama tab spreadsheet hasil, mis. `Sheet1` | – |
| `SHEET_DO_ID` / `SHEET_DO_TAB` | ID Google Sheet Delivery Order / tab `DO` | – |
| `SHEET_TO_ID` / `SHEET_TO_TAB` | ID Google Sheet Transfer Order / tab `TO` | – |
| `SHEET_BOQ_ID` / `SHEET_BOQ_TAB` | ID Google Sheet BOQ / tab `BOQ` | – |
| `SHEET_SMDT_ID` / `SHEET_SMDT_TAB` | ID Google Sheet SMDT / tab `Stock` (akun WHControl perlu akses edit) | – |
| `DRIVE_FOLDER_PIC_DO_ID` | ID folder Photo PIC DO (foto PIC yang meminta verifikasi DO) | – |
| `DRIVE_FOLDER_PIC_TO_ID` | ID folder Photo PIC TO | – |
| `DRIVE_FOLDER_PIC_BOQ_ID` | ID folder Photo PIC BOQ | – |
| `DRIVE_FOLDER_EVIDENCE_DO_ID` | ID folder Evidence DO (foto evidence verifikasi DO, v5.2) | – |
| `DRIVE_FOLDER_EVIDENCE_TO_ID` | ID folder Evidence TO | – |
| `DRIVE_FOLDER_EVIDENCE_BOQ_ID` | ID folder Evidence BOQ | – |
| `SHEET_VERIFY_ID` | Opsional. Kosongkan agar spreadsheet Verifikasi dibuat otomatis | – |
| `JWT_SECRET` | acak, minimal 32 karakter (lihat SETUP-GOOGLE langkah 5) | **Ya** |
| `GEOCODE_CONTACT_EMAIL` | email kontak operasional (dipakai di User-Agent OpenStreetMap) | – |

Catatan:

- Di Vercel, nama tab yang memuat spasi/`&` diketik **tanpa tanda kutip**, contohnya `Username & Password`. Tanda kutip hanya dipakai di file `.env.local`.
- Tandai variabel rahasia sebagai **Sensitive** bila opsi itu tersedia.
- Setelah mengubah variabel di kemudian hari, lakukan **Redeploy** (Deployments → titik tiga → Redeploy) agar nilai baru terpakai.

## 5. Deploy

Klik **Deploy**. Build berlangsung ±1–3 menit. Bila gagal:

- Buka log build. Galat TypeScript menunjukkan nama file dan baris.
- Pastikan versi Node di **Settings → Build and Deployment → Node.js Version** adalah 20.x atau lebih baru.

## 6. Domain

- Vercel otomatis memberi alamat `https://whcontrol-xxxx.vercel.app` (HTTPS, sehingga kamera dan GPS bisa dipakai).
- Untuk nama yang lebih rapi: **Settings → Domains**. Ganti subdomain `*.vercel.app` (bila tersedia), atau tambahkan domain perusahaan lalu ikuti instruksi DNS (CNAME ke `cname.vercel-dns.com`).
- Kamera dan GPS **hanya bekerja di HTTPS**. Jangan membagikan alamat `http://`.

## 7. Uji pascadeploy (wajib, ±15 menit)

Gunakan HP Android (Chrome) **dan** iPhone (Safari), keduanya membuka alamat HTTPS langsung, bukan dari dalam aplikasi chat/media sosial.

1. Login dengan satu akun uji: password salah harus ditolak dengan pesan umum, password benar harus berhasil.
2. **Mulai Laporan** → izinkan Kamera dan Lokasi → selfie awal.
3. Isi Data Gudang (Region hanya berisi kota akun itu).
4. Isi 2–3 material dan ambil fotonya. Pastikan HP harus diputar ke landscape dan watermark terbaca.
5. Review → Foto penutup (kamera belakang) → Kirim → Selesai → **Unduh PDF**.
6. Cek di Google Drive dan Sheets:
   - setiap folder foto berisi file dengan nama sesuai format;
   - folder Formulir Material Stock berisi PDF;
   - spreadsheet hasil mendapat 1 baris per material, dengan link foto/PDF yang bisa dibuka.
7. Ulangi pemeriksaan dengan checklist lengkap di **[docs/CHECKLIST-UJI.md](CHECKLIST-UJI.md)**.

Bila login menampilkan "Layanan sedang bermasalah", buka Vercel → **Logs** dan cari baris `[WHControl]`. Isinya menjelaskan penyebab (token, ID, nama tab, atau header) tanpa menampilkan rahasia.

---

## 8. Batas paket Hobby dan dampaknya ke WHControl

Angka resmi saat panduan ini ditulis (November 2026). Cek ulang di <https://vercel.com/docs/limits>.

| Batas Hobby | Nilai | Pemakaian WHControl | Status |
|---|---|---|---|
| Durasi maksimal fungsi (Fluid compute) | 300 detik | Unggah 1 foto: 1–3 detik. Simpan laporan + PDF 100 material: ±5–15 detik. `maxDuration` diset 60 detik (upload) dan 120 detik (submit) | Aman |
| Ukuran body request/response | 4,5 MB | Foto dikompres ≤ ±1 MB (maks 4 MB diterima server) dan diunggah satu per satu. PDF ±0,7 MB | Aman |
| Function invocations | 1 juta / bulan | Per laporan ≈ 2 × (jumlah foto) + 5. Laporan 10 material ≈ 30 panggilan. 1.000 laporan/bulan ≈ 30.000 | Aman |
| Active CPU | 4 jam / bulan | Pembuatan PDF ±0,3–1 detik CPU per laporan. Unggah sebagian besar menunggu jaringan (tidak dihitung) | Aman |
| Fast Origin Transfer | 10 GB / bulan | **Paling mungkin tersentuh.** Foto yang diunggah dan PDF yang diunduh lewat fungsi ikut dihitung. Laporan 10 material ≈ 5–8 MB, jadi ±1.300–2.000 laporan/bulan | **Pantau** |
| Fast Data Transfer | 100 GB / bulan | Halaman web ±0,4 MB per kunjungan pertama | Aman |

**Risiko yang perlu diketahui:**

1. **Fast Origin Transfer 10 GB.** Bila subcont mengirim sangat banyak laporan bergambar, kuota ini bisa habis sebelum akhir bulan, dan aplikasi berhenti melayani sampai bulan berikutnya. Pantau di **Vercel → Usage**. Bila mendekati batas, pindah ke Pro (lihat OPERASIONAL.md).
2. **Ketentuan Hobby untuk pemakaian non-komersial** (keputusan #14). Risiko penangguhan sudah diterima klien. Mitigasinya: kode ada di GitHub dan semua env terdokumentasi, sehingga pindah ke Pro atau hosting lain bisa dilakukan dalam ±30 menit.
3. **Instance server bisa lebih dari satu.** Cache 5 menit dan rate limit login berlaku per instance (*best effort*, keputusan #24).
