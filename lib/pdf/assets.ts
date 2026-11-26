/**
 * Logo resolusi tinggi untuk PDF (dibaca dari disk server).
 * File disertakan ke fungsi Vercel lewat `outputFileTracingIncludes` di next.config.ts.
 * Untuk mengganti logo, cukup timpa file PNG di folder assets/ (latar putih/transparan).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PdfAssets } from "./material-stock";

let cached: PdfAssets | null = null;

export async function loadPdfAssets(): Promise<PdfAssets> {
  if (cached) return cached;
  const dir = path.join(process.cwd(), "src", "lib", "pdf", "assets");
  const [yofcLogoPng, myRepublicLogoPng] = await Promise.all([
    readFile(path.join(dir, "yofc-logo.png")),
    readFile(path.join(dir, "myrepublic-logo.png")),
  ]);
  cached = { yofcLogoPng, myRepublicLogoPng };
  return cached;
}
