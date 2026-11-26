/**
 * Memeriksa koneksi Google dan isi database tanpa menampilkan rahasia.
 *
 *   npm run google:check
 *
 * Yang diperiksa: refresh token, akses dan jenis setiap file/folder di env,
 * nama tab, header kolom, serta ringkasan isi database.
 */
import { loadEnvFile } from "./load-env.mjs";
import { ConfigError, getGeocodeContactEmail, getJwtSecret, getMaterialSheet, getRegionSheet, getResultSheet, getUsersSheet, type SheetRef } from "../src/lib/env";
import { headerMatches } from "../src/lib/report/finalize";
import { RESULT_HEADERS } from "../src/lib/report/rows";
import { getDriveFileMeta, MIME_FOLDER, MIME_SHEET } from "../src/lib/google/drive";
import { explainGoogleError, GoogleApiError } from "../src/lib/google/errors";
import { getAccessToken } from "../src/lib/google/oauth";
import { parseMaterials, parseRegions, parseUsers } from "../src/lib/google/parse";
import { readSheetValues } from "../src/lib/google/sheets";

loadEnvFile(".env.local");

let failures = 0;

function ok(label: string, detail = "") {
  console.log(`  ✔ ${label}${detail ? `  ${detail}` : ""}`);
}

function fail(label: string, err: unknown) {
  failures++;
  const reason =
    err instanceof GoogleApiError ? explainGoogleError(err) : err instanceof Error ? err.message : String(err);
  console.log(`  ✘ ${label}\n      ${reason}`);
}

async function step(label: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    ok(label, detail ?? "");
  } catch (err) {
    fail(label, err);
  }
}

async function checkSheet(label: string, getRef: () => SheetRef, summarize: (values: string[][]) => string) {
  await step(`${label}: file Google Sheets`, async () => {
    const ref = getRef();
    const meta = await getDriveFileMeta(ref.spreadsheetId);
    if (meta.mimeType !== MIME_SHEET) {
      throw new Error(`"${meta.name}" bukan Google Sheets asli (${meta.mimeType}). Konversi dulu.`);
    }
    return `"${meta.name}"`;
  });
  await step(`${label}: tab dan isi`, async () => {
    const ref = getRef();
    return summarize(await readSheetValues(ref));
  });
}

async function checkFolder(envName: string) {
  await step(`Folder ${envName}`, async () => {
    const id = process.env[envName]?.trim();
    if (!id) throw new ConfigError(`${envName} belum diisi.`);
    const meta = await getDriveFileMeta(id);
    if (meta.mimeType !== MIME_FOLDER) throw new Error(`"${meta.name}" bukan folder.`);
    return `"${meta.name}"`;
  });
}

async function main() {
  console.log("\nPemeriksaan koneksi Google WHControl\n");

  await step("Refresh token & access token", async () => {
    await getAccessToken();
  });
  if (failures > 0) {
    console.log("\nPerbaiki token terlebih dahulu (lihat docs/SETUP-GOOGLE.md).\n");
    process.exit(1);
  }

  await checkSheet("Username and Password", getUsersSheet, (values) => {
    const dir = parseUsers(values);
    return `${dir.users.size} akun, ${dir.duplicatesIgnored} baris ganda diabaikan, ${dir.conflicts.size} nama konflik`;
  });
  await checkSheet("Subcont and City Area", getRegionSheet, (values) => {
    const map = parseRegions(values);
    const cities = new Set([...map.values()].flat());
    return `${map.size} subcont, ${cities.size} kota unik`;
  });
  await checkSheet("Material and Remarks", getMaterialSheet, (values) => {
    const list = parseMaterials(values);
    const noRemark = list.filter((m) => m.remarks.length === 1 && m.remarks[0] === "-").length;
    return `${list.length} material (${noRemark} tanpa remark → "-")`;
  });

  await checkSheet("Spreadsheet hasil (WHControl)", getResultSheet, (values) => {
    const header = values[0] ?? [];
    if (!headerMatches(header)) {
      throw new Error(`Header baris 1 harus persis 20 kolom: ${RESULT_HEADERS.join(" | ")}`);
    }
    return `header 20 kolom sesuai, ${Math.max(0, values.length - 1)} baris data`;
  });

  await step("JWT_SECRET", async () => {
    getJwtSecret();
  });
  await step("GEOCODE_CONTACT_EMAIL", async () => {
    const email = getGeocodeContactEmail();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Format email tidak valid.");
  });

  for (const name of [
    "DRIVE_ROOT_FOLDER_ID",
    "DRIVE_FOLDER_PAO_ID",
    "DRIVE_FOLDER_PAC_ID",
    "DRIVE_FOLDER_EVIDENCE_ID",
    "DRIVE_FOLDER_FORM_ID",
  ]) {
    await checkFolder(name);
  }

  console.log(failures === 0 ? "\nSemua pemeriksaan lolos.\n" : `\n${failures} pemeriksaan gagal. Lihat keterangan di atas.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
