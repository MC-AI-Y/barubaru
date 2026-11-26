import { googleFetch, type GoogleFetchOptions } from "./http";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
  parents?: string[];
}

export const MIME_FOLDER = "application/vnd.google-apps.folder";
export const MIME_SHEET = "application/vnd.google-apps.spreadsheet";

const FIELDS = "id,name,mimeType,webViewLink,appProperties,parents";

/** Metadata satu file/folder Drive. */
export async function getDriveFileMeta(fileId: string, options: GoogleFetchOptions = {}): Promise<DriveFileMeta> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=${FIELDS}&supportsAllDrives=true`;
  const res = await googleFetch(url, { method: "GET" }, options);
  return (await res.json()) as DriveFileMeta;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Mencari file berdasarkan kunci unik (appProperties.whcKey) di sebuah folder.
 * Dipakai agar unggahan ulang (sinyal putus, tombol ditekan dua kali) tidak membuat file ganda.
 */
export async function findDriveFileByKey(folderId: string, key: string, options: GoogleFetchOptions = {}): Promise<DriveFileMeta | null> {
  const q = `'${escapeQuery(folderId)}' in parents and trashed = false and appProperties has { key='whcKey' and value='${escapeQuery(key)}' }`;
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(${FIELDS})&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await googleFetch(url, { method: "GET" }, options);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files?.[0] ?? null;
}

/** Unggah file kecil (≤ 5 MB) dengan multipart upload. */
export async function uploadDriveFile(
  args: { folderId: string; name: string; mimeType: string; data: Uint8Array; appProperties: Record<string, string> },
  options: GoogleFetchOptions = {},
): Promise<DriveFileMeta> {
  const boundary = `whc${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name: args.name, parents: [args.folderId], appProperties: args.appProperties });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${args.mimeType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([head, Buffer.from(args.data), tail]);

  const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=${FIELDS}&supportsAllDrives=true`;
  const res = await googleFetch(
    url,
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    options,
  );
  return (await res.json()) as DriveFileMeta;
}

/** Mengunduh isi file. */
export async function downloadDriveFile(fileId: string, options: GoogleFetchOptions = {}): Promise<ArrayBuffer> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await googleFetch(url, { method: "GET" }, options);
  return res.arrayBuffer();
}

/** Link tampilan file Drive (dipakai bila webViewLink tidak dikembalikan). */
export function driveViewLink(file: DriveFileMeta): string {
  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
}

/** Mencari beberapa file dengan query Drive (maks. `pageSize`). */
export async function listDriveFiles(q: string, pageSize = 20, options: GoogleFetchOptions = {}): Promise<DriveFileMeta[]> {
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(${FIELDS})&pageSize=${pageSize}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await googleFetch(url, { method: "GET" }, options);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files ?? [];
}

/** Membuat file/folder tanpa isi (hanya metadata). */
export async function createDriveMetaFile(
  args: { name: string; mimeType: string; parents?: string[]; appProperties: Record<string, string> },
  options: GoogleFetchOptions = {},
): Promise<DriveFileMeta> {
  const url = `${DRIVE_API}?fields=${FIELDS}&supportsAllDrives=true`;
  const res = await googleFetch(
    url,
    { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(args) },
    options,
  );
  return (await res.json()) as DriveFileMeta;
}

/** Mengganti appProperties sebuah file. */
export async function updateDriveAppProperties(fileId: string, appProperties: Record<string, string>, options: GoogleFetchOptions = {}): Promise<void> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`;
  await googleFetch(
    url,
    { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ appProperties }) },
    options,
  );
}

/** Menghapus file permanen (hanya untuk file milik akun WHControl). */
export async function deleteDriveFile(fileId: string, options: GoogleFetchOptions = {}): Promise<void> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?supportsAllDrives=true`;
  await googleFetch(url, { method: "DELETE" }, options);
}

export { escapeQuery as escapeDriveQuery };
