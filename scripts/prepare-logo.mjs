#!/usr/bin/env node
/**
 * Menyiapkan logo YOFC versi web dari file sumber "Logo YOFC.png".
 *
 * Yang dilakukan:
 *   1. Memangkas margin putih di sekeliling logo.
 *   2. Membuat dua ukuran: 360 px (layar biasa) dan 720 px (layar retina).
 *   3. Menyimpan dalam format WebP (utama) dan PNG (cadangan) di public/logo/.
 *
 * Cara pakai (dari folder proyek):
 *   npm run logo -- "path/ke/Logo YOFC.png"
 *
 * File sumber 1,6 MB TIDAK di-commit dan tidak dimuat browser.
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const input = process.argv[2] ?? "Logo YOFC.png";
const outDir = path.resolve("public/logo");
const WIDTHS = [
  { width: 360, suffix: "" },
  { width: 720, suffix: "@2x" },
];

async function main() {
  try {
    await stat(input);
  } catch {
    console.error(`File sumber tidak ditemukan: ${input}`);
    console.error('Contoh: npm run logo -- "C:/Users/nama/Downloads/Logo YOFC.png"');
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  // Ratakan transparansi ke putih dulu (langkah terpisah, karena sharp
  // menjalankan trim sebelum flatten dalam satu pipeline), lalu pangkas margin.
  const flattened = await sharp(input).flatten({ background: "#ffffff" }).png().toBuffer();
  const trimmed = await sharp(flattened)
    .trim({ background: "#ffffff", threshold: 20 })
    .toBuffer({ resolveWithObject: true });

  console.log(`Setelah dipangkas: ${trimmed.info.width} x ${trimmed.info.height} px`);

  for (const { width, suffix } of WIDTHS) {
    const base = sharp(trimmed.data).resize({ width, withoutEnlargement: true });
    const webpPath = path.join(outDir, `yofc-logo${suffix}.webp`);
    const pngPath = path.join(outDir, `yofc-logo${suffix}.png`);

    await base.clone().webp({ quality: 90, effort: 6 }).toFile(webpPath);
    await base.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(pngPath);

    for (const file of [webpPath, pngPath]) {
      const { size } = await stat(file);
      console.log(`  ${path.relative(process.cwd(), file)}  ${(size / 1024).toFixed(1)} KB`);
    }
  }

  console.log("Selesai. Logo web tersimpan di public/logo/.");
}

main().catch((err) => {
  console.error("Gagal menyiapkan logo:", err instanceof Error ? err.message : err);
  process.exit(1);
});
