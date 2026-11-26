/**
 * Watermark digambar LANGSUNG ke piksel foto (bukan overlay HTML), readme bagian 5.
 * 7 baris: tanggal & waktu, lokasi, Subcont Name, Warehouse Name, Material, Remark, Quantity & Satuan.
 * Panel semi-transparan di sudut kiri bawah; ukuran huruf proporsional dengan lebar foto.
 */
import { formatDateTime } from "@/lib/format/time";
import { formatQuantity } from "@/lib/report/validate";
import type { CaptureContext } from "@/lib/report/types";

export interface WatermarkInput {
  capture: CaptureContext;
  subcontName: string;
  warehouseName: string;
  material: string;
  remark: string;
  quantity: number;
  unit: string;
}

export function watermarkLines(w: WatermarkInput): string[] {
  const coords = `${w.capture.lat.toFixed(5)}, ${w.capture.lon.toFixed(5)}`;
  const location = w.capture.source === "coordinates" ? coords : `${w.capture.short} (${coords})`;
  return [
    formatDateTime(w.capture.t, w.capture.zone),
    location,
    w.subcontName,
    w.warehouseName,
    w.material,
    w.remark,
    `${formatQuantity(w.quantity)} ${w.unit}`,
  ];
}

/** Maksimal baris material di watermark dokumen; sisanya diringkas "+N material lainnya". */
export const DOC_WATERMARK_MAX_ITEMS = 8;

/**
 * Watermark foto verifikasi DO/TO/BOQ (revisi 26 Nov 2026): format Visit, 1 foto mewakili seluruh dokumen.
 *   Tanggal & waktu · Lokasi · Subcont Name · Warehouse Name (Subcont City) · lalu satu baris per material:
 *   "<Material> · Remark: - · <Quantity Satuan>" (Remark "-" karena DO/TO/BOQ tidak punya kolom Remark).
 */
export function documentWatermarkLines(w: {
  capture: CaptureContext;
  subcontName: string;
  warehouseName: string;
  items: readonly { material: string; qty: number | null; unit: string }[];
}): string[] {
  const coords = `${w.capture.lat.toFixed(5)}, ${w.capture.lon.toFixed(5)}`;
  const location = w.capture.source === "coordinates" ? coords : `${w.capture.short} (${coords})`;
  const shown = w.items.slice(0, DOC_WATERMARK_MAX_ITEMS).map((i) => `${i.material} · Remark: - · ${i.qty === null ? "-" : formatQuantity(i.qty)} ${i.unit}`);
  const rest = w.items.length - shown.length;
  return [
    formatDateTime(w.capture.t, w.capture.zone),
    location,
    w.subcontName,
    w.warehouseName,
    ...shown,
    ...(rest > 0 ? [`+${rest} material lainnya`] : []),
  ];
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

export function drawWatermark(canvas: HTMLCanvasElement, lines: readonly string[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  // Huruf ±2% lebar foto (min 14 px) agar tetap terbaca di HP maupun saat dicetak.
  const fontSize = Math.max(14, Math.round(W * 0.02));
  const lineH = Math.round(fontSize * 1.3);
  const pad = Math.round(fontSize * 0.7);
  const margin = Math.round(fontSize * 0.6);
  const maxTextW = W * 0.78 - pad * 2;

  ctx.save();
  // Diukur dengan huruf tebal agar panel pasti cukup lebar.
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = "top";
  const fitted = lines.map((l) => fitText(ctx, l, maxTextW));
  const textW = Math.max(...fitted.map((l) => ctx.measureText(l).width));
  const panelW = Math.ceil(textW + pad * 2);
  const panelH = fitted.length * lineH + pad * 2 - (lineH - fontSize);
  const x = margin;
  const y = H - panelH - margin;

  // Panel semi-transparan dengan garis aksen merek di kiri.
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, panelW, panelH, Math.round(fontSize * 0.4));
  else ctx.rect(x, y, panelW, panelH);
  ctx.fill();
  ctx.fillStyle = "#ff9d00";
  ctx.fillRect(x, y, Math.max(3, Math.round(fontSize * 0.18)), panelH);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = Math.round(fontSize * 0.15);
  fitted.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 600} ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillText(line, x + pad, y + pad + i * lineH);
  });
  ctx.restore();
}
