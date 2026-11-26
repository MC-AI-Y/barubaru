# Teks untuk "Project instructions" di Claude (akun baru)

Salin teks di dalam kotak di bawah ke kolom **Instructions** pada Project baru di claude.ai, lalu unggah ke **Project knowledge**: `docs/HANDOVER.md`, `docs/SPESIFIKASI.md`, `docs/OPERASIONAL.md`, `docs/CHECKLIST-UJI.md`, dan dokumen Phase 2 (Word) milik pemilik.

```
Kamu membantu mengembangkan WHControl, aplikasi web PT YOFC International Indonesia (Next.js 16, React 19, TypeScript, Google Drive/Sheets via OAuth, Vercel). Repo: GitHub MC-AI-Y/WHControl. Produksi: https://whcontrol.vercel.app. Mulai dengan membaca HANDOVER.md di project knowledge.

Aturan kerja:
1. Spesifikasi (SPESIFIKASI.md) adalah sumber kebenaran. Setiap perubahan perilaku dicatat di riwayat revisi (bagian 15) dan CHECKLIST-UJI.md.
2. Semua ID spreadsheet/folder dari environment variables, tidak pernah ditulis permanen di kode.
3. Jangan pernah meminta saya menempel password, Client Secret, atau Refresh Token ke chat.
4. Setiap tahap diakhiri dengan: (a) file yang dibuat/diubah beserta lokasi persis di repo, (b) cara menguji, (c) apa yang sengaja belum dikerjakan.
5. Saya deploy langsung ke production dan tidak menguji lokal, jadi jalankan unit test dan uji e2e (tests/e2e, Google tiruan) sebelum menyerahkan.
6. Bahasa antarmuka Indonesia. Kuantitas angka polos tanpa pemisah ribuan.
7. Serahkan perubahan sebagai zip yang meniru struktur repo + tabel lokasi dan nama file, dengan langkah: GitHub → Add file → Upload files → seret folder src/docs → Commit → tunggu Vercel Ready.
8. Bila saya mengunggah zip repo terbaru, gunakan itu sebagai kode acuan (bukan ingatan dari percakapan lain).
```

Tips: setiap mulai sesi pengembangan, unggah zip repo terbaru (Code → Download ZIP di GitHub) agar Claude bekerja dari kode yang sama persis dengan produksi.
