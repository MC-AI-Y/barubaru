# Panduan untuk Claude (dan pengembang)

Proyek: **WHControl** (PT YOFC International Indonesia), Next.js 16 + Google Drive/Sheets. Baca `docs/HANDOVER.md` sebelum mengubah apa pun.

## Aturan kerja

- Spesifikasi (`docs/SPESIFIKASI.md`) adalah sumber kebenaran; setiap perubahan perilaku dicatat di bagian 15 dan di `docs/CHECKLIST-UJI.md`.
- Semua ID spreadsheet/folder dibaca dari environment variables (`src/lib/env.ts`), tidak pernah ditulis permanen.
- Jangan pernah meminta, menampilkan, atau meng-commit password, Client Secret, Refresh Token, atau isi `.env*`.
- Bahasa antarmuka Indonesia. Kuantitas = angka polos tanpa pemisah ribuan.
- Judul kolom sheet dicari berdasarkan nama (dengan alias), bukan posisi.
- Fitur yang env-nya belum diisi cukup menampilkan pesan; tidak boleh merusak fitur lain (terutama Visit).
- Data uji harus fiktif; jangan menyimpan data asli di repo.

## Sebelum menyerahkan perubahan

1. `npm test` dan `npx tsc --noEmit` lolos.
2. `cd tests/e2e && npm test` lolos (Google tiruan; tambah tiruan bila memakai endpoint Google baru).
3. Laporkan: (a) file dibuat/diubah + lokasi persis, (b) cara menguji di produksi, (c) yang sengaja belum dikerjakan.
4. Pemilik mengunggah manual lewat web GitHub dan langsung deploy ke production: serahkan zip berstruktur repo + tabel lokasi file.
