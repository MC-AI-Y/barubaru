import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | WHControl",
  description: "Kebijakan privasi aplikasi WHControl (Warehouse Control) YOFC.",
};

const wrap = { height: "100dvh", overflowY: "auto" as const, background: "#f4f6f9" };
const card = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "32px 20px 56px",
  lineHeight: 1.65,
  color: "#182132",
  fontSize: 15,
};
const h2 = { fontSize: 18, margin: "28px 0 8px" };

/** Halaman publik kebijakan privasi (dibutuhkan layar izin OAuth Google). */
export default function PrivacyPage() {
  const contact = process.env.GEOCODE_CONTACT_EMAIL?.trim();
  return (
    <main style={wrap}>
      <article style={card}>
        <p style={{ fontWeight: 700, color: "#006794", letterSpacing: "0.08em", fontSize: 12 }}>WHCONTROL · YOFC</p>
        <h1 style={{ fontSize: 28, margin: "4px 0 4px" }}>Kebijakan Privasi</h1>
        <p style={{ color: "#556175", fontSize: 13 }}>Berlaku sejak 5 November 2026</p>

        <p style={{ marginTop: 20 }}>
          WHControl (Warehouse Control) adalah aplikasi internal PT YOFC International Indonesia untuk pelaporan stok
          material gudang oleh subkontraktor YOFC. Aplikasi ini hanya dapat dipakai oleh akun subkontraktor yang
          terdaftar.
        </p>

        <h2 style={h2}>1. Data yang dikumpulkan</h2>
        <ul>
          <li>Nama subkontraktor (Subcont Name) untuk login.</li>
          <li>Isian laporan: region, nama gudang, nama PIC, nama SPV dan PM/RPM YOFC, material, remark, jumlah, satuan, dan catatan.</li>
          <li>Foto selfie awal dan penutup, serta foto material yang diambil langsung dari kamera perangkat.</li>
          <li>Lokasi GPS (koordinat) dan alamat hasil konversi koordinat, saat foto diambil.</li>
          <li>Waktu pengambilan foto dan waktu pengiriman laporan (dicatat oleh server).</li>
        </ul>

        <h2 style={h2}>2. Tujuan penggunaan</h2>
        <p>
          Data hanya digunakan untuk membuktikan dan mencatat stok material gudang, membuat formulir Material Stock (PDF),
          serta keperluan audit internal YOFC. Data tidak dijual dan tidak dipakai untuk iklan.
        </p>

        <h2 style={h2}>3. Tempat penyimpanan</h2>
        <ul>
          <li>Foto, PDF, dan data laporan disimpan di Google Drive dan Google Sheets milik akun Google khusus WHControl yang dikelola YOFC.</li>
          <li>Draf laporan yang belum dikirim disimpan sementara di perangkat pengguna (penyimpanan browser) dan dihapus setelah laporan berhasil dikirim atau draf dibuang.</li>
          <li>Sesi login disimpan dalam cookie aman (httpOnly) selama maksimal 12 jam.</li>
        </ul>

        <h2 style={h2}>4. Layanan pihak ketiga</h2>
        <ul>
          <li>Google Drive API dan Google Sheets API: menyimpan foto, PDF, dan data laporan.</li>
          <li>OpenStreetMap Nominatim dan BigDataCloud: mengubah koordinat GPS menjadi alamat. Hanya koordinat yang dikirim.</li>
          <li>Vercel: hosting aplikasi.</li>
        </ul>
        <p>
          Akses aplikasi ke Google hanya untuk akun khusus WHControl milik YOFC, dan hanya dipakai untuk membaca data
          referensi serta menyimpan laporan. Penggunaan data dari Google API mematuhi Google API Services User Data Policy,
          termasuk persyaratan Limited Use.
        </p>

        <h2 style={h2}>5. Akses dan keamanan</h2>
        <p>
          Data laporan hanya dapat diakses oleh admin YOFC yang berwenang. Akses ke data dibatasi, koneksi memakai HTTPS,
          dan percobaan login dibatasi untuk mencegah penyalahgunaan.
        </p>

        <h2 style={h2}>6. Penyimpanan dan penghapusan</h2>
        <p>
          Data disimpan selama diperlukan untuk keperluan operasional dan audit YOFC. Permintaan koreksi atau penghapusan
          data dapat diajukan ke kontak di bawah.
        </p>

        <h2 style={h2}>7. Kontak</h2>
        <p>
          PT YOFC International Indonesia{contact ? (
            <>
              {" "}
              · <a href={`mailto:${contact}`}>{contact}</a>
            </>
          ) : null}
        </p>

        <p style={{ marginTop: 32 }}>
          <a href="/" style={{ color: "#006794", fontWeight: 600 }}>
            ← Kembali ke WHControl
          </a>
        </p>
      </article>
    </main>
  );
}
