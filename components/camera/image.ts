/**
 * Pengolahan gambar di browser: ambil frame dari video, perkecil, kompres JPEG.
 * Target: sisi panjang maks 1600 px, JPEG ±80%, ukuran < ±1 MB (readme bagian 5).
 */

export const MAX_SIDE = 1600;
export const THUMB_SIDE = 320;
const TARGET_BYTES = 1024 * 1024;

/** Ambil frame video saat ini ke canvas berukuran ≤ maxSide. */
export function grabFrame(video: HTMLVideoElement, maxSide = MAX_SIDE): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pengolahan gambar.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto."))), "image/jpeg", quality);
  });
}

/** JPEG ±80%, diturunkan bertahap bila masih > 1 MB. */
export async function compressCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  let blob = await canvasToBlob(canvas, 0.8);
  for (const q of [0.7, 0.6, 0.5]) {
    if (blob.size <= TARGET_BYTES) break;
    blob = await canvasToBlob(canvas, q);
  }
  return blob;
}

export async function makeThumbnail(source: HTMLCanvasElement, side = THUMB_SIDE): Promise<Blob> {
  const scale = Math.min(1, side / Math.max(source.width, source.height));
  const c = document.createElement("canvas");
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  c.getContext("2d")?.drawImage(source, 0, 0, c.width, c.height);
  const blob = await canvasToBlob(c, 0.72);
  releaseCanvas(c);
  return blob;
}

/** Melepas memori canvas (penting di HP kelas menengah). */
export function releaseCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

/**
 * Gambar dari galeri → JPEG terkompres (sisi panjang maks 1600 px).
 * Orientasi EXIF diikuti oleh browser (createImageBitmap imageOrientation "from-image").
 */
export async function imageFileToJpeg(file: Blob, maxSide = MAX_SIDE): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Gambar tidak bisa dibuka. Pilih foto JPG atau PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pengolahan gambar.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  try {
    return await compressCanvas(canvas);
  } finally {
    releaseCanvas(canvas);
  }
}
