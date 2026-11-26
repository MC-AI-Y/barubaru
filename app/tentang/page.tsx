import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tentang WHControl | Warehouse Control YOFC",
  description: "WHControl: aplikasi pelaporan stok material gudang subkontraktor PT YOFC International Indonesia.",
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
const btn = {
  display: "inline-block",
  marginTop: 8,
  padding: "12px 20px",
  borderRadius: 12,
  background: "#006794",
  color: "#fff",
  fontWeight: 600,
  textDecoration: "none",
};

/** Halaman publik tentang aplikasi (homepage untuk layar izin OAuth Google, tanpa login). */
export default function AboutPage() {
  return (
    <main style={wrap}>
      <article style={card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/yofc-logo.png" alt="YOFC" width={154} height={60} style={{ width: 154, height: 60 }} />
        <h1 style={{ fontSize: 30, margin: "20px 0 4px" }}>WHControl</h1>
        <p style={{ fontWeight: 700, color: "#006794", letterSpacing: "0.12em", fontSize: 12 }}>WAREHOUSE CONTROL</p>

        <p style={{ marginTop: 20 }}>
          WHControl adalah aplikasi web internal milik <strong>PT YOFC International Indonesia</strong> untuk pelaporan
          stok material gudang oleh subkontraktor YOFC. Setiap laporan dilengkapi foto bukti dari kamera dan formulir
          Material Stock (PDF) yang dibuat otomatis.
        </p>

        <h2 style={h2}>Fungsi aplikasi</h2>
        <ul>
          <li>Login subkontraktor dengan akun yang diberikan YOFC.</li>
          <li>Selfie awal dan penutup sebagai bukti kehadiran di gudang.</li>
          <li>Pencatatan material, remark, jumlah, dan satuan, beserta foto berwatermark (waktu, lokasi, dan data material).</li>
          <li>Penyimpanan laporan ke Google Drive dan Google Sheets milik YOFC, serta pembuatan PDF Form Material Stock.</li>
        </ul>

        <h2 style={h2}>Penggunaan data Google</h2>
        <p>
          Aplikasi mengakses Google Drive dan Google Sheets hanya melalui satu akun Google khusus milik YOFC, untuk
          membaca data referensi (akun subkontraktor, kota, dan material) serta menyimpan foto, PDF, dan baris laporan.
          Aplikasi tidak mengakses akun Google milik pengguna lain. Rincian ada di{" "}
          <a href="/privasi">Kebijakan Privasi</a>.
        </p>

        <h2 style={h2}>Siapa yang boleh memakai</h2>
        <p>Hanya subkontraktor YOFC yang terdaftar. Akun dan password diberikan oleh admin YOFC.</p>

        <p style={{ marginTop: 28 }}>
          <a href="/" style={btn}>
            Masuk ke WHControl
          </a>
        </p>
        <p style={{ marginTop: 16, fontSize: 13, color: "#556175" }}>
          <a href="/privasi">Kebijakan Privasi</a> · PT YOFC International Indonesia
        </p>
      </article>
    </main>
  );
}
