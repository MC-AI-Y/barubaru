# Serah Terima Pengembangan WHControl

Dokumen ini untuk tim/akun baru yang melanjutkan pengembangan WHControl. Isinya pengetahuan yang sebelumnya hanya ada di percakapan pengembangan: aturan kerja, keputusan, peta kode, status, dan pekerjaan berikutnya.

Baca berurutan: dokumen ini → `docs/SPESIFIKASI.md` (detail fitur v4.7 + riwayat revisi Phase 2 di bagian 15) → `docs/OPERASIONAL.md` → `docs/DEPLOY.md` → `docs/CHECKLIST-UJI.md`.

**Status per 26 November 2026:** versi **v5.3.3** (Phase 2 + revisi DO/TO/BOQ: status dari kolom Verified, PIC, watermark, BOQ format sederhana, Dashboard terverifikasi/belum; v5.2: **2 foto verifikasi** (Evidence + PIC), notifikasi Beranda/toast diperbaiki; v5.3: nilai kolom Verified baru DO/TO/BOQ; v5.3.1: chip merah "Perlu verifikasi" kembali, kotak PIC di atas & Evidence di bawah; v5.3.2: Dashboard disederhanakan + filter bisa diketik; v5.3.3: tanpa kartu KPI, filter Region/Subcont/City/Material). Produksi: https://whcontrol.vercel.app

---

## 1. Ringkasan aplikasi

WHControl (Warehouse Control) adalah aplikasi web PT YOFC International Indonesia untuk kontrol material di gudang subkontraktor (subcont). Ada 5 menu setelah login:

| Menu | Untuk | Inti |
|---|---|---|
| Dashboard | Subcont & admin | Stok per Subcont City dari SEMUA DO/TO/BOQ dibanding Visit terakhir (format SMDT): 4 filter yang bisa diketik (Region, Subcont, City, Material), grafik In vs Out dan Stock by Data vs Stock Visit (+GAP), tabel detail (✓ = bagian terverifikasi). Admin bisa menulis ulang sheet SMDT |
| DO (Delivery Order) | Subcont tujuan memverifikasi, admin memutuskan | Daftar per nomor DO |
| TO (Transfer Order) | Subcont tujuan memverifikasi (TO masuk), subcont asal hanya melihat (TO keluar) | Daftar per nomor TO |
| BOQ | Subcont pemilik memverifikasi | Per Site Name + Subcont City (format sederhana, tanpa PO) |
| Visit | Khusus subcont | Alur laporan stok gudang v4.7: selfie, data gudang (satu kota), foto material berwatermark, review, foto penutup, PDF Material Stock |

Peran: akun dengan username `admin` di sheet Username and Password = **admin**; lainnya = **subcont**.

Alur verifikasi DO/TO/BOQ (status = isi kolom **Verified** di sheet asli, ditampilkan apa adanya):

```
DO/TO:
(kosong) / ON DELIVERY* ──(subcont: PIC + telepon + 2 foto kamera berwatermark)──▶ RECEIVED
RECEIVED ──(admin buka foto, Setujui)──▶ APPROVED   (SMDT ditulis ulang)
RECEIVED ──(admin Tolak + alasan)──▶ NEED CHECK ──(subcont kirim ulang)──▶ RECEIVED
(* ON DELIVERY hanya DO)

BOQ (tanpa keputusan admin):
(kosong) ──(subcont: PIC + telepon + 2 foto + pilih APD / ABD / RFSC / FO CUT/VANDALISME)──▶ pilihan itu = terverifikasi (SMDT ditulis ulang)
```

Saat subcont mengirim (v5.2: 2 foto kamera), aplikasi mengisi kolom `PIC Name` = "Nama (telepon)", `Photo Evidence PIC` = link foto PIC (folder Photo PIC DO/TO/BOQ, kamera depan), `Photo Evidence` = link foto evidence (folder Evidence DO/TO/BOQ, kamera belakang), dan `Verified`.

---

## 2. Aturan kerja (wajib dipertahankan)

1. **Spesifikasi adalah sumber kebenaran.** Perubahan perilaku dicatat di `docs/SPESIFIKASI.md` bagian 15 (riwayat revisi) dan `docs/CHECKLIST-UJI.md`.
2. **Semua ID spreadsheet/folder dari environment variables.** Tidak boleh ditulis permanen di kode.
3. **Jangan pernah meminta atau menempel password, Client Secret, Refresh Token ke chat**, issue, atau commit. Rahasia hanya di Vercel dan `.env.local` admin.
4. **Setiap tahap/perubahan diakhiri dengan:** (a) file yang dibuat/diubah beserta lokasi persis di repo, (b) cara menguji, (c) apa yang sengaja belum dikerjakan.
5. **Pemilik deploy langsung ke production** (tidak menguji lokal). Jadi uji otomatis harus dijalankan sebelum menyerahkan perubahan.
6. **Bahasa antarmuka Indonesia**, ramah dan jelas. Istilah kolom database tetap seperti di sheet.
7. **Cara serah file ke pemilik:** zip yang meniru struktur repo + tabel lokasi/nama file + langkah: GitHub → Add file → Upload files → seret folder `src`/`docs` → Commit → tunggu Vercel Ready. (Pemilik mengunggah manual lewat web GitHub.)
8. Kuantitas ditulis **angka polos tanpa pemisah ribuan** di mana pun (keputusan v4.6).

---

## 3. Stack dan infrastruktur

- Next.js 16 App Router, React 19, TypeScript strict, CSS Modules + token desain (`src/styles/tokens.css`).
- Backend = API Routes di Vercel (paket Hobby; risiko komersial diterima klien).
- Google Drive & Sheets lewat **OAuth refresh token akun Google khusus WHControl** (bukan service account; alasan di SPESIFIKASI bagian 10). Pemanggilan lewat `fetch` biasa (`src/lib/google/http.ts`, dengan retry).
- PDF: pdf-lib. Draf di perangkat: IndexedDB. Kamera: getUserMedia (flash/torch & tap-to-focus bila didukung).
- Tanpa database/penyimpanan eksternal (tanpa Redis). Cache dan rate limit di memori per instance (best effort).
- Sesi: cookie JWT HMAC `whc_session` 12 jam, sidik password (ganti password = sesi lama batal), cek same-origin untuk POST.

### Data di Google (folder Warehouse Control → Database)

| Sumber | Env | Catatan |
|---|---|---|
| Username and Password | `SHEET_USERS_ID/_TAB` | Kolom `Subcont`/`Subcont Name`, `Password` (polos, akses ketat) |
| Subcont and City Area | `SHEET_REGION_ID/_TAB` | Subcont, City (+ Subcont City, Region di Phase 2). Sel digabung ditangani forward-fill |
| Material and Remarks | `SHEET_MATERIAL_ID/_TAB` | Material, Remark |
| Hasil Visit | `SHEET_RESULT_ID/_TAB` | 21 kolom A–U (U = Subcont City sejak v5.0) |
| DO / TO / BOQ | `SHEET_DO_*`, `SHEET_TO_*`, `SHEET_BOQ_*` | Diisi admin; aplikasi membaca + menulis kolom Verified, PIC Name, Photo Evidence PIC, Photo Evidence |
| SMDT → Stock | `SHEET_SMDT_ID/_TAB` | Ditulis ulang aplikasi; kolom Remarks dipertahankan |
| WHControl - Verifikasi | otomatis (opsional `SHEET_VERIFY_ID`) | Riwayat verifikasi (bukan sumber status). Dibuat otomatis di My Drive akun WHControl, ditemukan lewat Drive appProperties `whcKey=WHC_VERIFY_SHEET`. Tab DO/TO/BOQ, 25 kolom (V–W: PIC Name, PIC Phone; X–Y: PIC Photo File ID, PIC Photo Link) |
| Folder foto | `DRIVE_FOLDER_PAO_ID`, `_PAC_ID`, `_EVIDENCE_ID`, `_FORM_ID`, `_PIC_DO_ID`, `_PIC_TO_ID`, `_PIC_BOQ_ID`, `_EVIDENCE_DO_ID`, `_EVIDENCE_TO_ID`, `_EVIDENCE_BOQ_ID` | Folder verifikasi boleh Restricted (foto ditampilkan lewat server). v5.2: PIC dan Evidence wajib keduanya |
| Status draf lintas perangkat | otomatis | Folder "WHControl - Status Draf" di My Drive akun WHControl |

Daftar lengkap env ada di `.env.example` dan `docs/DEPLOY.md`. ID asli (bukan rahasia) tercantum di dokumen Phase 2 pemilik.

---

## 4. Peta kode

```
src/app/_screens/            Tampilan (satu halaman, perpindahan layar via flow.tsx)
  WHControlApp.tsx           Kerangka, header, peta layar
  flow.tsx, steps.ts         Navigasi & daftar layar/fitur (FEATURES, READY_FEATURES)
  HomeScreen / HubScreen     Halaman depan (belum login) / menu 5 fitur + "Perlu tindakan"
  VisitHomeScreen + Selfie/Gudang/Material/Review/Submit/Done   Alur Visit
  OrdersScreen.tsx           DO/TO/BOQ: daftar, detail, verifikasi subcont, keputusan admin
  DashboardScreen.tsx        Dashboard stok + Perbarui SMDT
  api.ts                     Pemanggil API dari browser
  report/                    Draf Visit (IndexedDB), konteks kamera, kirim laporan
src/app/api/                 API Routes
  auth/*                     login, logout, session (role ikut dikirim)
  reference/*, capture/*, upload, submit, report/pdf, draft/status   Visit (403 untuk admin)
  orders, orders/detail, orders/counts                             DO/TO/BOQ
  verify, verify/photo       Kirim verifikasi (2 foto kamera + PIC) & tampilkan foto (?which=pic untuk foto PIC)
  admin/decide               Setujui/Tolak (DO/TO saja)
  dashboard, admin/smdt-sync Dashboard & tulis SMDT
src/lib/
  auth/                      sesi, role.ts (admin), rate-limit.ts, server.ts (getActiveSession, galat)
  google/                    http, drive, sheets, parse (findColumns, HEADER_ALIASES), cache (TTL)
  orders/                    parse.ts (judul kolom → baris), access.ts (siapa melihat apa, status, filter),
                             status.ts (nilai kolom Verified), store.ts (cache 2 mnt),
                             write.ts (tulis Verified/PIC/link foto), http.ts
  verify/                    records.ts (format baris Verifikasi), store.ts (buat/baca/tulis spreadsheet Verifikasi)
  dashboard/                 visit.ts (Inventory Actual), compute.ts (rumus SMDT), smdt.ts, store.ts
  report/, format/, pdf/     Visit: validasi, baris hasil, nama file, format region/waktu, PDF
tests/e2e/                   Uji layar otomatis dengan Google tiruan (lihat bagian 7)
```

Konsep penting:

- **Judul kolom dicari berdasarkan nama**, bukan posisi (`locateHeader` di `orders/parse.ts`, `findColumns` di `google/parse.ts`). Alias judul: `Subcont Name` ⇄ `Subcont`, `DO NUMBER` ⇄ `DO NO`, dll. Bila judul tidak cocok, API mengirim pesan yang menyebut kolomnya.
- **Status dokumen** (`orders/status.ts`, `orders/access.ts → statusOf`): HANYA dari kolom Verified di sheet asli. Nilai per jenis di `STATUS_VALUES` (open / pending / approved / rejected; BOQ tanpa pending & rejected, `needsAdminDecision("boq") = false`). Nilai lama dikenali lewat `LEGACY`. Spreadsheet Verifikasi hanya riwayat (foto, PIC, alasan tolak).
- **Kepemilikan**: DO/TO via kolom WH/SUPPLIER DESTINATION (atau ORIGIN untuk TO keluar), BOQ via kolom Subcont; harus sama dengan nama login (tanpa beda huruf/spasi). Bila kolom subcont kosong, dipakai awalan Subcont City.
- **Kirim verifikasi** (`api/verify`): unggah 2 foto → tulis PIC/link/status ke sheet (`orders/write.ts → writeDocumentCells`; DO/TO `RECEIVED`, BOQ pilihan subcont + SMDT ditulis ulang lewat `dashboard/sync.ts`) → catatan Verifikasi. **Keputusan admin** (DO/TO saja) menulis APPROVED/NEED CHECK ke baris yang dicari ulang dari data terbaru, lalu catatan Verifikasi, lalu SMDT.
- **R8 (sebagian terjawab v5.3):** RFSC kini juga salah satu pilihan kolom Verified BOQ.
- **Watermark dokumen**: `components/camera/watermark.ts → documentWatermarkLines`, kamera mode `document` (bebas orientasi).
- **Dashboard** menghitung semua baris; `verifiedPart`/`inVerified`/`outVerified` menyimpan bagian yang disetujui.
- **Idempoten**: verifikasi pakai `verificationId` (UUID dari perangkat) + penanda Drive `verify:<id>` (evidence) dan `verify-pic:<id>` (PIC); laporan Visit pakai Submission ID.

---

## 5. Keputusan Phase 2 (jawaban pemilik)

| # | Keputusan |
|---|---|
| Q1 | Username `admin` dikenali sebagai admin |
| Q2 | Notifikasi hanya di dalam aplikasi (tanpa email/WA) |
| Q3 | Subcont City = Subcont + spasi + City, mis. "CV DAYA ABADI BOGOR" |
| Q4 | Region berisi wilayah seperti "Jabodetabek", "East Java" |
| Q5 | Spreadsheet hasil Visit tetap yang lama |
| Q6 | Kolom Verified berisi teks "Verified" atau checkbox |
| Q7 | Inventory Actual = Visit terakhir per Subcont City |
| Q8 | Remarks SMDT diisi admin manual |
| Q10 | Desain mengikuti prototipe teman pemilik (diadaptasi, bukan disalin): warna #006699, kartu KPI, filter, kartu dokumen, modal detail |
| Q11 | Admin boleh menolak (dengan alasan) |
| Q12 | 1 foto per dokumen. v5.0.1 sempat boleh galeri; **v5.1: wajib kamera, berwatermark format Visit, + nama & telepon PIC** (telepon digabung di kolom PIC Name). **v5.2: 2 foto** — Photo Evidence (kamera belakang) + Photo Evidence PIC (kamera depan, bisa dibalik) |
| Q13 | TO diverifikasi subcont tujuan, lalu admin |
| Q14 | DO/TO diverifikasi per nomor dokumen |
| Q15 | BOQ per Site Name + Subcont City (v5.1: format BOQ sederhana tanpa PO Number) |
| Q16 | Subcont tidak boleh mengedit data DO/TO/BOQ |
| Q17 | Visit = satu Subcont City; tambah kolom U di hasil Visit |
| Q18 | Volume data ±17 ribu baris sejak 2021 |
| Q19 | Nama material DO/TO/BOQ sama dengan database material |
| Q20 | Judul `Subcont` dan `Subcont Name` sama-sama diterima |
| R2 | Spreadsheet Verifikasi dibuat otomatis di My Drive akun WHControl |
| R3 | Folder Evidence boleh Restricted |
| R4 | **Judul kolom yang benar = dokumen Phase 2 pemilik** (+ revisi 26 Nov: PIC Name, Photo Evidence PIC, BOQ sederhana). CSV prototipe teman hanya contoh tampilan |
| v5.1 | Status hanya dari kolom Verified (nilai v5.1 WAIT ADMIN/VERIFIED/REJECTED, BOQ NEED CHECK/APD/ABD; diganti v5.3) |
| v5.1 | Stok Dashboard bertambah walau dokumen belum diverifikasi; terverifikasi dan belum dibedakan |
| v5.3 | Verified DO: ON DELIVERY / RECEIVED / APPROVED / NEED CHECK. TO: RECEIVED / APPROVED / NEED CHECK. Subcont kirim = RECEIVED, admin setuju = APPROVED, tolak = NEED CHECK |
| v5.3 | Verified BOQ: APD / ABD / RFSC / FO CUT/VANDALISME, **dipilih subcont** saat verifikasi; admin hanya melihat |
| v5.2 | Verifikasi 2 foto: evidence ≠ PIC (PIC = siapa yang meminta verifikasi). Kolom sheet `Photo Evidence` |
| v5.3.3 | Dashboard: 6 kartu KPI dihapus. Filter Region, Subcont, City, Material (sama untuk admin dan subcont, saling menyaring). Baris stok punya `city` (kolom CITY sheet, cadangan Subcont City − Subcont) |
| v5.3.2 | Dashboard disederhanakan: hapus Hitung dari, teks terverifikasi/belum di KPI, Peringatan GAP, Visit terakhir, Peringkat Subcont City, baris biru notifikasi. Data vs Aktual → Stock by Data vs Stock Visit + angka GAP. Filter = dropdown yang bisa diketik |
| v5.3.1 | Kotak PIC (nama, telepon, Foto PIC) di atas detail; Foto Evidence + Kirim di paling bawah; Keputusan admin di bawah. Chip merah "Perlu verifikasi"/"Perlu persetujuan" + oranye "Belum diverifikasi" seperti versi awal, selain chip isi kolom Verified |

Masih terbuka (dipakai asumsi, konfirmasi ke pemilik):

- **R5** Dashboard memakai kolom QTY untuk DO/TO/BOQ.
- **R6** Belum ada contoh data TO asli.
- **R7** Bila BOQ tidak punya kolom Subcont City/Detail, Subcont City dibentuk dari Subcont + City.
- **R8** Arti kode Status BOQ (RFSC, Redline, BOQ Opname) belum dijelaskan; ditampilkan apa adanya.
- **R9** Pastikan prototipe teman (berisi data asli dan password di kode) tidak pernah dipublikasikan.

---

## 6. Status dan pekerjaan berikutnya

Selesai: semua fitur di bagian 1. Riwayat per versi: `docs/SPESIFIKASI.md` bagian 15.

Belum dikerjakan / kandidat berikutnya:

1. **Dokumen Word spesifikasi v5.0 Final** (gabungan v4.7 + Phase 2). Bagian 1–14 `SPESIFIKASI.md` masih menjelaskan v4.7; Phase 2 baru ada di riwayat revisi.
2. Unduh **.xlsx** di Dashboard (sekarang CSV).
3. Tanda "Subcont City tidak dikenal" untuk DO/TO/BOQ yang Subcont City-nya tidak ada di Subcont and City Area.
4. Konfirmasi R5–R9 lalu sesuaikan.
5. Opsional dari spesifikasi v4: pengingat laporan tgl 1 & 15, mode offline penuh.

Batas yang perlu diingat:

- Vercel Hobby: body request ±4,5 MB (foto dikompres ≤1600 px), durasi fungsi ≤60 dtk.
- Cache: DO/TO/BOQ 2 menit, catatan Verifikasi 20 detik, database referensi ±5 menit. Tombol **Muat ulang** memaksa data terbaru.
- Rate limit & cache per instance serverless (bukan global).

---

## 7. Cara menguji

**Unit test** (logika murni, 115 uji):

```bash
npm install
npm test            # = tsx --test (semua *.test.ts di src/)
npx tsc --noEmit    # cek tipe
```

**Uji layar otomatis (e2e)** dengan Google tiruan dan data **fiktif** (tanpa akun/data asli):

```bash
cd tests/e2e
npm install && npx playwright install chromium
npm test                     # bundel + jalankan 12 skrip, masing-masing dengan server bersih
node run.mjs verify decide   # skrip tertentu
npm run serve                # server uji di http://127.0.0.1:4400 untuk dicoba manual
```

Akun uji: `cv uji kreasi nusantara / Uji12345`, `cv uji satu / Daya4385`, `admin / Admin12345`. Tangkapan layar tersimpan di `tests/e2e/shots/`. Data uji dibuat oleh `make-fixtures.mjs`. Google tiruan ada di `fake-server.ts` (meniru Drive/Sheets yang dipakai aplikasi, termasuk endpoint bantu `/__state`, `/__verify`, `/__smdt` untuk memeriksa hasil).

Bila menambah fitur yang memanggil endpoint Google baru, tambahkan tiruannya di `fake-server.ts`.

**Uji di produksi:** ikuti `docs/CHECKLIST-UJI.md` (bagian B2–B13 untuk Phase 2 dan revisi v5.1–v5.3.3).

---

## 8. Pelajaran dari pengembangan (agar tidak terulang)

- Pemilik pernah mengganti judul kolom `Subcont Name` → `Subcont` dan produksi error "Layanan sedang bermasalah". Sejak itu judul dicari dengan alias. Bila ada error setelah pemilik mengubah sheet, periksa judul kolom dulu.
- Unggah lewat web GitHub kadang **melewatkan file baru** (pernah: `LoginScreen.module.css` tidak terunggah → build Vercel gagal "Module not found"). Saat build gagal, cek file yang disebut ada di repo.
- Repo pemilik memakai **CRLF** di beberapa file; itu wajar.
- Visit harus tetap bekerja walau env Phase 2 belum diisi: fitur yang env-nya kosong cukup menampilkan pesan, tidak boleh merusak fitur lain.
- Jangan menyimpan data asli (nama subcont, PO, password) di repo, termasuk di data uji.
