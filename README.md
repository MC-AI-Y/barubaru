# WHControl (Warehouse Control)

Aplikasi web untuk subkontraktor YOFC melaporkan stok material gudang. Setiap laporan memuat:

- selfie awal (PAO) dan selfie penutup (PAC) dari kamera langsung;
- foto setiap material dengan **watermark otomatis** (waktu resmi server, lokasi GPS, data material);
- **PDF Form Material Stock** yang dibuat otomatis.

Semua foto dan PDF tersimpan di Google Drive, datanya di Google Sheets.

| Dokumen | Isi |
|---|---|
| [docs/SPESIFIKASI.md](docs/SPESIFIKASI.md) | Spesifikasi final (sumber kebenaran) |
| [docs/SETUP-GOOGLE.md](docs/SETUP-GOOGLE.md) | Setup OAuth Google, refresh token, cek koneksi |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy ke Vercel Hobby langkah demi langkah + batas Hobby |
| [docs/OPERASIONAL.md](docs/OPERASIONAL.md) | Pekerjaan admin: subcont/material baru, ganti password, rotasi, pindah hosting |
| [docs/CHECKLIST-UJI.md](docs/CHECKLIST-UJI.md) | Lembar uji manual untuk klien |
| [docs/TEMUAN-PENGUATAN.md](docs/TEMUAN-PENGUATAN.md) | Hasil pengujian, temuan, dan perbaikannya |

---

## Gambaran alur

```
Beranda → Login → Selfie Awal (PAO) → Data Gudang → Material (berulang) → Review
        → Selfie Penutup (PAC) → Kirim (unggah foto → PDF → spreadsheet) → Selesai (unduh PDF)
```

- **Login:** Subcont Name diketik manual (tidak peka huruf besar/kecil dan spasi berlebih), password dicocokkan persis. Sesi 12 jam.
- **Foto:** hanya dari kamera (tanpa galeri). Foto material wajib landscape dan berwatermark. Tombol potret menunggu waktu resmi dari server.
- **Lokasi:** OpenStreetMap Nominatim (server) → BigDataCloud (browser) → koordinat. Foto tidak pernah gagal karena alamat.
- **Draf:** tersimpan di HP (IndexedDB) beserta foto. Aman bila tab tertutup atau sinyal putus.
- **Kirim:** foto diunggah satu per satu (ulang otomatis). Setelah semua sukses, PDF dibuat dan **semua baris ditulis sekaligus**. Kirim ulang tidak membuat data ganda.

## Teknologi

Next.js 16 (App Router) + TypeScript strict, di-deploy di Vercel. Google Drive API dan Sheets API diakses lewat OAuth refresh token akun khusus WHControl (tanpa paket `googleapis`). PDF memakai `pdf-lib`. Tidak ada database atau layanan berbayar lain.

## Menjalankan di komputer

Kebutuhan: Node.js **20.9+** (disarankan LTS terbaru).

```bash
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
# isi .env.local (lihat docs/SETUP-GOOGLE.md)
npm run google:token -- --write   # sekali saja: refresh token Google
npm run google:check              # semua harus ✔
npm run dev                       # buka http://localhost:3000
```

Kamera dan GPS di HP butuh HTTPS. Untuk mencoba di HP, pakai deploy Vercel (Preview/Production), bukan `http://IP-komputer:3000`. Di laptop, `http://localhost` diizinkan browser.

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build` / `npm run start` | Build dan jalankan versi produksi |
| `npm run typecheck` | Pemeriksaan TypeScript (jalankan `dev`/`build` sekali dulu) |
| `npm test` | 79 unit test (forward-fill, dedupe, pencocokan nama, format Region, nama file, zona waktu, sesi, rate limit, klien Google, konteks foto, penyimpanan laporan) |
| `npm run google:token -- --write` | Membuat refresh token Google (lokal, sekali) |
| `npm run google:check` | Cek token, ID file/folder, nama tab, header spreadsheet hasil, isi database |
| `npm run logo -- "<path>"` | Menyiapkan ulang logo web dari `Logo YOFC.png` |

## Environment Variables

Semua dibaca dari env, tidak ada ID atau rahasia yang ditulis di kode. Contoh lengkap ada di [.env.example](.env.example).

| Variabel | Isi |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Client (tipe Desktop app) |
| `GOOGLE_REFRESH_TOKEN` | Refresh token akun khusus WHControl |
| `DRIVE_ROOT_FOLDER_ID` | Folder Warehouse Control |
| `DRIVE_FOLDER_PAO_ID`, `DRIVE_FOLDER_PAC_ID` | Folder selfie awal / penutup |
| `DRIVE_FOLDER_EVIDENCE_ID` | Folder foto material berwatermark |
| `DRIVE_FOLDER_FORM_ID` | Folder PDF Formulir Material Stock |
| `SHEET_USERS_ID` + `SHEET_USERS_TAB` | Username and Password (`Username & Password`) |
| `SHEET_REGION_ID` + `SHEET_REGION_TAB` | Subcont and City Area (`Subcont & City Control`) |
| `SHEET_MATERIAL_ID` + `SHEET_MATERIAL_TAB` | Material and Remarks (`Sheet1`) |
| `SHEET_RESULT_ID` + `SHEET_RESULT_TAB` | Spreadsheet hasil (header 20 kolom A–T) |
| `SHEET_DO_ID` + `SHEET_DO_TAB` | Delivery Order (`DO`) |
| `SHEET_TO_ID` + `SHEET_TO_TAB` | Transfer Order (`TO`) |
| `SHEET_BOQ_ID` + `SHEET_BOQ_TAB` | BOQ (`BOQ`) |
| `SHEET_SMDT_ID` + `SHEET_SMDT_TAB` | SMDT (`Stock`), rekap Dashboard |
| `DRIVE_FOLDER_PIC_DO_ID`, `_TO_ID`, `_BOQ_ID` | Folder Photo PIC DO/TO/BOQ (foto PIC yang meminta verifikasi) |
| `DRIVE_FOLDER_EVIDENCE_DO_ID`, `_TO_ID`, `_BOQ_ID` | Folder Evidence DO/TO/BOQ (foto evidence verifikasi, v5.2) |
| `SHEET_VERIFY_ID` | Opsional; spreadsheet Verifikasi (kosong = dibuat otomatis) |
| `JWT_SECRET` | Kunci sesi, acak, ≥ 32 karakter |
| `GEOCODE_CONTACT_EMAIL` | Email kontak untuk OpenStreetMap |

**Jangan pernah commit** `.env*` (kecuali `.env.example`), folder `Database`, file `.xlsx`, atau kredensial Google. Semuanya sudah ada di `.gitignore`.

## Pekerjaan admin (ringkas)

Rincian ada di [docs/OPERASIONAL.md](docs/OPERASIONAL.md). Perubahan spreadsheet terbaca aplikasi dalam ±5 menit, tanpa perlu deploy ulang.

- **Subcont baru:** tambah baris di *Username and Password* (nama unik, kolom Password format *Plain text*), lalu tambah kota-kotanya di *Subcont and City Area*.
- **Material/remark baru:** tambah baris di *Material and Remarks*. Remark kosong berarti otomatis `-`.
- **Ganti password:** ubah sel Password. Sesi lama otomatis berakhir.
- **Refresh token kedaluwarsa** (login menampilkan "Layanan sedang bermasalah", log Vercel menyebut refresh token): jalankan `npm run google:token -- --write` dengan akun khusus WHControl, salin token baru ke Vercel, lalu Redeploy.
- **Jangan ubah** header baris 1 spreadsheet hasil maupun nama tab tanpa memperbarui env.

## Struktur folder

```
whcontrol/
├── README.md
├── .gitignore / .env.example / package.json / tsconfig.json
├── next.config.ts              # header keamanan, aset PDF ikut ter-deploy
├── public/logo/                # logo YOFC versi web (dikecilkan)
├── scripts/
│   ├── get-refresh-token.mjs   # sekali: refresh token Google (lokal)
│   ├── check-google.ts         # cek koneksi & data
│   ├── load-env.mjs            # pembaca .env.local untuk skrip
│   └── prepare-logo.mjs        # alat bantu logo web
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx
│   │   ├── _screens/           # layar: Beranda, Login, Selfie, Data Gudang, Material, Review, Kirim, Selesai
│   │   │   └── report/         # draf IndexedDB, konteks foto, proses kirim di browser
│   │   └── api/
│   │       ├── auth/{login,logout,session}
│   │       ├── reference/{regions,materials}
│   │       ├── capture/context # waktu server + lokasi + tanda tangan
│   │       ├── upload          # unggah 1 foto ke Drive
│   │       ├── submit          # PDF + tulis semua baris
│   │       └── report/pdf      # unduh PDF milik akun
│   ├── components/
│   │   ├── camera/             # kamera (getUserMedia), watermark, kompresi, GPS
│   │   ├── layout/             # header, stepper, kerangka layar
│   │   └── ui/                 # tombol, kartu, input, checklist, dialog, toast
│   ├── lib/
│   │   ├── env.ts
│   │   ├── google/             # OAuth, Drive, Sheets, pembaca database, cache
│   │   ├── auth/               # login, sesi, rate limit
│   │   ├── geo/                # Nominatim + cache lokasi
│   │   ├── format/             # Region, nama file, zona waktu, pencocokan nama
│   │   ├── report/             # tipe, validasi, tanda tangan, baris sheet, penyimpanan akhir
│   │   └── pdf/                # generator PDF + logo resolusi tinggi
│   └── styles/                 # token desain & gaya global
└── docs/
```
