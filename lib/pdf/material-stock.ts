/**
 * PDF Form Material Stock (readme bagian 9), digambar ulang lewat kode (pdf-lib),
 * bukan konversi dari Excel.
 *  - A4 lanskap. Cambria tidak bisa disertakan (berlisensi), jadi dipakai Times (serif standar PDF).
 *  - Header: logo MyRepublic kiri, logo YOFC kanan, judul "MATERIAL STOCK".
 *  - Tabel maksimal 25 baris per halaman, header tabel diulang.
 *  - Catatan bawah + blok nama penanggung jawab hanya di halaman terakhir.
 *  - Tidak ada tanda tangan. Kata "From" dari template tidak dicetak.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export interface PdfMaterialRow {
  name: string;
  /** Sudah diformat, misalnya "1200 M". */
  quantity: string;
  remark: string;
  notes: string;
}

export interface MaterialStockData {
  subcontName: string;
  /** Format form: "Bogor, Depok, dan Cibubur". */
  region: string;
  warehouseName: string;
  /** Location saat selfie PAO. */
  warehouseAddress: string;
  /** Tanggal saat selfie PAO, misalnya "04/11/2026". */
  date: string;
  pic: string;
  spv: string;
  pm: string;
  materials: PdfMaterialRow[];
  submissionId: string;
}

export interface PdfAssets {
  yofcLogoPng: Uint8Array;
  myRepublicLogoPng: Uint8Array;
}

/** Teks tetap dari template (dicetak apa adanya). */
export const TEMPLATE_NOTES = [
  "1. Subcontractor must be sign this commitment with SPV/RPM/MC YOFC before submit material request on email,  without this commitment cannot proceed material delivery.",
  "2. Subcontractor must send material stock data every 1st and 15th of each month (twice per month)",
] as const;

export const ROWS_PER_PAGE = 25;

// A4 lanskap (pt)
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 34;
const TOP = 26;
const BOTTOM = 34;
const CONTENT_W = PAGE_W - MX * 2;

/** Lebar kolom mengikuti proporsi template (kolom B–E). */
const COL_RATIOS = [25.66, 15.66, 64.89, 40.89];
const COL_W = COL_RATIOS.map((r) => (r / COL_RATIOS.reduce((a, b) => a + b, 0)) * CONTENT_W);
const COL_ALIGN: ("left" | "center")[] = ["left", "center", "center", "left"];

const HEADER_GREEN = rgb(0.663, 0.816, 0.557); // aksen hijau template (accent 6, tint 40%)
const BLACK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.42, 0.45, 0.5);
const BORDER = rgb(0.25, 0.25, 0.25);

const F_BODY = 10;
const F_TABLE = 9;
const LH = 13;
const TABLE_LH = 10.5;
const CELL_PAD_X = 5;
const CELL_PAD_Y = 1.5;
const TABLE_HEAD_H = 22;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Mengganti karakter yang tidak didukung font standar PDF (WinAnsi) agar PDF tidak gagal dibuat. */
export function makeSanitizer(font: PDFFont): (text: string) => string {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    Array.from(
      text
        .normalize("NFKC")
        .replace(/[‘’]/g, "'")
        .replace(/[“”″]/g, '"')
        .replace(/[–—]/g, "-")
        .replace(/[\r\n\t]+/g, " "),
    )
      .map((ch) => (supported.has(ch.codePointAt(0) ?? 0) ? ch : "?"))
      .join("");
}

/** Memecah teks menjadi baris sesuai lebar; kata yang terlalu panjang dipotong per karakter. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  const width = (s: string) => font.widthOfTextAtSize(s, size);

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (width(word) <= maxWidth) {
      line = word;
      continue;
    }
    // Kata sangat panjang: potong per karakter.
    let chunk = "";
    for (const ch of word) {
      if (width(chunk + ch) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

function drawLogo(page: PDFPage, img: PDFImage, x: number, yTop: number, height: number, alignRight = false): void {
  const w = (img.width / img.height) * height;
  page.drawImage(img, { x: alignRight ? x - w : x, y: yTop - height, width: w, height });
}

export async function generateMaterialStockPdf(data: MaterialStockData, assets: PdfAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Material Stock - ${data.subcontName}`);
  doc.setAuthor("WHControl");
  doc.setSubject(`Submission ${data.submissionId}`);
  doc.setCreator("WHControl (YOFC)");
  doc.setProducer("WHControl");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const clean = makeSanitizer(fonts.regular);
  const yofc = await doc.embedPng(assets.yofcLogoPng);
  const myrep = await doc.embedPng(assets.myRepublicLogoPng);

  const pages: PDFPage[] = [];

  /** Header halaman: logo + judul. Mengembalikan posisi y di bawah header. */
  function newPage(): { page: PDFPage; y: number } {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    const top = PAGE_H - TOP;
    drawLogo(page, myrep, MX, top - 6, 26);
    drawLogo(page, yofc, PAGE_W - MX, top, 40, true);
    const title = "MATERIAL STOCK";
    const tw = fonts.bold.widthOfTextAtSize(title, 20);
    page.drawText(title, { x: (PAGE_W - tw) / 2, y: top - 30, size: 20, font: fonts.bold, color: BLACK });
    return { page, y: top - 52 };
  }

  function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxW: number, font: PDFFont, size: number, center = false): number {
    const lines = wrapText(clean(text), font, size, maxW);
    for (const line of lines) {
      const w = font.widthOfTextAtSize(line, size);
      page.drawText(line, { x: center ? x + (maxW - w) / 2 : x, y, size, font, color: BLACK });
      y -= LH;
    }
    return y;
  }

  function drawTableHeader(page: PDFPage, yTop: number): number {
    const labels = ["Material Name", "Quantity", "Remark", "Note"];
    let x = MX;
    labels.forEach((label, i) => {
      const w = COL_W[i]!;
      page.drawRectangle({ x, y: yTop - TABLE_HEAD_H, width: w, height: TABLE_HEAD_H, color: HEADER_GREEN, borderColor: BORDER, borderWidth: 0.6 });
      const tw = fonts.bold.widthOfTextAtSize(label, F_BODY);
      page.drawText(label, { x: x + (w - tw) / 2, y: yTop - TABLE_HEAD_H / 2 - 3.5, size: F_BODY, font: fonts.bold, color: BLACK });
      x += w;
    });
    return yTop - TABLE_HEAD_H;
  }

  function rowLayout(row: PdfMaterialRow): { cells: string[][]; height: number } {
    const values = [row.name, row.quantity, row.remark, row.notes || ""];
    const cells = values.map((v, i) => wrapText(clean(v), fonts.regular, F_TABLE, COL_W[i]! - CELL_PAD_X * 2));
    const lines = Math.max(...cells.map((c) => c.length));
    return { cells, height: Math.max(13, lines * TABLE_LH + CELL_PAD_Y * 2 + 1) };
  }

  function drawRow(page: PDFPage, yTop: number, layout: { cells: string[][]; height: number }): number {
    let x = MX;
    layout.cells.forEach((lines, i) => {
      const w = COL_W[i]!;
      page.drawRectangle({ x, y: yTop - layout.height, width: w, height: layout.height, borderColor: BORDER, borderWidth: 0.6 });
      let ty = yTop - CELL_PAD_Y - F_TABLE + 0.5;
      for (const line of lines) {
        const lw = fonts.regular.widthOfTextAtSize(line, F_TABLE);
        const tx = COL_ALIGN[i] === "center" ? x + (w - lw) / 2 : x + CELL_PAD_X;
        page.drawText(line, { x: tx, y: ty, size: F_TABLE, font: fonts.regular, color: BLACK });
        ty -= TABLE_LH;
      }
      x += w;
    });
    return yTop - layout.height;
  }

  // ── Halaman pertama: blok data + pernyataan ─────────────────
  let { page, y } = newPage();
  const LABEL_W = 132;
  const info: [string, string][] = [
    ["Subcontractor", data.subcontName],
    ["Region", data.region],
    ["WH Name", data.warehouseName],
    ["Warehouse Address", data.warehouseAddress],
    ["Date", data.date],
    ["PIC & Phone Number", data.pic],
  ];
  for (const [label, value] of info) {
    page.drawText(label, { x: MX, y, size: F_BODY, font: fonts.bold, color: BLACK });
    page.drawText(":", { x: MX + LABEL_W, y, size: F_BODY, font: fonts.bold, color: BLACK });
    y = drawWrapped(page, value, MX + LABEL_W + 8, y, CONTENT_W - LABEL_W - 8, fonts.bold, F_BODY);
  }
  y -= 6;
  const statement =
    `Here we ${data.subcontName}, which location in ${data.warehouseName} that for coverage area ${data.region} ` +
    "confirmed for material stock list below based on actual and real quantity in order to appropriate use as follow:";
  y = drawWrapped(page, statement, MX, y, CONTENT_W, fonts.bold, F_BODY, true);
  y -= 6;

  // ── Tabel dengan paginasi ───────────────────────────────────
  y = drawTableHeader(page, y);
  let rowsOnPage = 0;
  for (const row of data.materials) {
    const layout = rowLayout(row);
    if (rowsOnPage >= ROWS_PER_PAGE || y - layout.height < BOTTOM + 12) {
      ({ page, y } = newPage());
      page.drawText(clean(`${data.subcontName} - ${data.warehouseName} (lanjutan)`), { x: MX, y, size: F_BODY, font: fonts.bold, color: BLACK });
      y = drawTableHeader(page, y - 10);
      rowsOnPage = 0;
    }
    y = drawRow(page, y, layout);
    rowsOnPage++;
  }

  // ── Catatan + penanggung jawab (halaman terakhir) ───────────
  const noteLines = TEMPLATE_NOTES.map((n) => wrapText(clean(n), fonts.bold, F_BODY, CONTENT_W));
  const footerHeight = 14 + LH * (1 + noteLines.flat().length) + 8 + LH * 3;
  if (y - footerHeight < BOTTOM) {
    ({ page, y } = newPage());
  }
  y -= 14;
  page.drawText("Remark:", { x: MX, y, size: F_BODY, font: fonts.bold, color: BLACK });
  y -= LH;
  for (const lines of noteLines) {
    for (const line of lines) {
      page.drawText(line, { x: MX, y, size: F_BODY, font: fonts.bold, color: BLACK });
      y -= LH;
    }
  }
  y -= 8;
  const people: [string, string][] = [
    ["Subcontractor PIC", data.pic],
    ["YOFC SPV", data.spv],
    ["YOFC PM/RPM", data.pm],
  ];
  for (const [label, name] of people) {
    page.drawText(label, { x: MX, y, size: F_BODY, font: fonts.bold, color: BLACK });
    page.drawText(":", { x: MX + LABEL_W, y, size: F_BODY, font: fonts.bold, color: BLACK });
    page.drawText(clean(name), { x: MX + LABEL_W + 8, y, size: F_BODY, font: fonts.regular, color: BLACK });
    y -= LH;
  }

  // ── Nomor halaman & Submission ID ──────────────────────────
  pages.forEach((p, i) => {
    const label = `Halaman ${i + 1} dari ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: PAGE_W - MX - w, y: 16, size: 8, font: fonts.regular, color: GRAY });
    p.drawText(clean(`WHControl - Submission ID: ${data.submissionId}`), { x: MX, y: 16, size: 8, font: fonts.regular, color: GRAY });
  });

  return doc.save();
}
