# Setup Google untuk WHControl

Panduan menghubungkan WHControl ke Google Drive dan Google Sheets memakai **OAuth akun Google khusus WHControl** (readme bagian 10, Jalur A).
Semua langkah dilakukan **sekali** oleh admin internal, di komputer sendiri.

> **Aturan rahasia:** Client Secret dan Refresh Token hanya disimpan di `.env.local` (komputer admin) dan Environment Variables Vercel.
> Jangan dikirim lewat chat, email, atau di-commit ke GitHub.

---

## 0. Persiapan data di Drive

1. Login ke Google dengan **akun khusus WHControl**.
2. Pastikan folder **Warehouse Control** beserta seluruh isinya **dimiliki akun ini**. Bila dibuat akun lain, pindahkan kepemilikan atau buat ulang.
3. Konversi file Excel ke Google Sheets asli. Buka file, lalu pilih **File > Save as Google Sheets**. Lakukan untuk:
   - Username and Password
   - Subcont and City Area
   - Material and Remarks

   Pakai **ID file hasil konversi** (file .xlsx lama boleh dihapus atau diarsipkan).
4. Cabut semua link "Anyone with the link" pada folder `Database` (**Share > General access > Restricted**).

ID file ada di URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`. ID folder: `https://drive.google.com/drive/folders/<ID>`.

## 1. Buat project Google Cloud

1. Buka <https://console.cloud.google.com/> **dengan akun khusus WHControl**.
2. Buat project baru, misalnya `whcontrol`.
3. Buka **APIs & Services > Library**, lalu aktifkan:
   - **Google Drive API**
   - **Google Sheets API**

## 2. Atur layar izin OAuth

Menu ini bernama **Google Auth Platform** (atau **OAuth consent screen** di tampilan lama).

1. **Branding:** nama aplikasi `WHControl`, email dukungan = email akun khusus.
2. **Audience (jenis pengguna):** pilih sesuai jenis akun.

| Jenis akun | Pilihan | Catatan |
|---|---|---|
| **Google Workspace** (email domain perusahaan) | **Internal** | Tanpa verifikasi Google. Token tidak kedaluwarsa 7 hari. Bila admin Workspace membatasi aplikasi pihak ketiga, minta admin menandai aplikasi ini sebagai tepercaya (**Admin console > Security > API controls**). |
| **Gmail biasa** (@gmail.com) | **External**, lalu **Publish app** (status **In production**) | **Wajib.** Bila status masih **Testing**, refresh token **mati setelah 7 hari** dan login WHControl berhenti bekerja. |

**Khusus Gmail biasa (status In production):**

- Google akan menampilkan peringatan **"Google hasn't verified this app"** saat izin diberikan. Ini wajar karena aplikasi hanya dipakai akun sendiri. Klik **Advanced**, lalu **Go to WHControl (unsafe)**.
- Verifikasi Google **tidak diperlukan**. Aplikasi yang belum diverifikasi tetap boleh dipakai, dengan batas 100 akun, sedangkan WHControl hanya memakai 1 akun.

3. **Data Access (scopes):** boleh ditambahkan `.../auth/drive` dan `.../auth/spreadsheets`. Skrip token tetap memintanya walau langkah ini dilewati.

## 3. Buat OAuth Client

1. Buka **Clients > Create client** (atau **Credentials > Create credentials > OAuth client ID**).
2. Pada **Application type**, pilih **Desktop app**. Nama: `WHControl`.
3. Salin **Client ID** dan **Client Secret** ke `.env.local`:

```bash
# dari folder proyek
cp .env.example .env.local      # Windows: copy .env.example .env.local
```

Lalu isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.env.local`.

## 4. Dapatkan refresh token (sekali)

```bash
npm install
npm run google:token -- --write
```

1. Browser terbuka. **Login dengan akun khusus WHControl** dan izinkan akses Drive serta Sheets.
2. Terminal menampilkan akun yang memberi izin. Pastikan itu akun khusus WHControl.
3. Dengan `--write`, token langsung disimpan ke `.env.local`. Tanpa `--write`, token ditampilkan di terminal untuk disalin manual.

Bila muncul "Google tidak mengirim refresh token", buka <https://myaccount.google.com/permissions>, hapus akses WHControl, lalu jalankan ulang.

## 5. Isi variabel lainnya

Lengkapi `.env.local` (lihat `.env.example`):

- ID folder: `DRIVE_ROOT_FOLDER_ID`, `DRIVE_FOLDER_PAO_ID`, `DRIVE_FOLDER_PAC_ID`, `DRIVE_FOLDER_EVIDENCE_ID`, `DRIVE_FOLDER_FORM_ID`
- ID dan nama tab sheet: `SHEET_USERS_ID` dan `SHEET_USERS_TAB`, `SHEET_REGION_ID` dan `SHEET_REGION_TAB`, `SHEET_MATERIAL_ID` dan `SHEET_MATERIAL_TAB`
- `JWT_SECRET`: buat acak dengan perintah berikut.

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- `GEOCODE_CONTACT_EMAIL`: email kontak untuk OpenStreetMap (dipakai mulai Tahap 4).

## 6. Periksa koneksi

```bash
npm run google:check
```

Contoh hasil yang benar:

```
  ✔ Refresh token & access token
  ✔ Username and Password: file Google Sheets  "Username and Password"
  ✔ Username and Password: tab dan isi  138 akun, 5 baris ganda diabaikan, 0 nama konflik
  ✔ Subcont and City Area: tab dan isi  138 subcont, 79 kota unik
  ✔ Material and Remarks: tab dan isi  26 material (6 tanpa remark → "-")
  ✔ Folder DRIVE_ROOT_FOLDER_ID  "Warehouse Control"
  ...
```

Pesan galat menjelaskan penyebabnya, misalnya file masih .xlsx, nama tab salah, atau akun tidak punya akses. Nilai rahasia tidak pernah ditampilkan.

## 7. Pasang di Vercel

**Project > Settings > Environment Variables**: masukkan semua variabel dari `.env.local` (Production, dan Preview bila dipakai), lalu **Redeploy**.

## Kapan refresh token perlu dibuat ulang?

Jalankan ulang langkah 4 (lalu perbarui di Vercel) bila:

- akses aplikasi dicabut di <https://myaccount.google.com/permissions>,
- token tidak dipakai selama 6 bulan,
- aplikasi Gmail biasa ternyata masih berstatus **Testing** (token mati setelah 7 hari),
- Client Secret dibuat ulang atau OAuth client dihapus.

Gejalanya: login WHControl menampilkan "Layanan sedang bermasalah", dan log Vercel memuat "Refresh token tidak valid atau kedaluwarsa".
