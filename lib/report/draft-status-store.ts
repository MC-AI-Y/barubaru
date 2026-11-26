import {
  createDriveMetaFile,
  deleteDriveFile,
  escapeDriveQuery,
  listDriveFiles,
  MIME_FOLDER,
  updateDriveAppProperties,
} from "@/lib/google/drive";
import { DRAFT_PROP, draftStatusKey, fromDraftProps, toDraftProps, type DraftStatus, type DraftStatusInput } from "./draft-status";

/**
 * Penyimpanan ringkasan draf di Drive akun WHControl.
 *
 * Folder sistem dibuat otomatis di "My Drive" akun WHControl (bukan di folder
 * Warehouse Control), sehingga tidak terlihat oleh orang lain yang hanya
 * diberi akses ke folder Warehouse Control. Isinya file kosong; ringkasan ada
 * di appProperties.
 */

const FOLDER_KEY = "WHC_DRAFT_STATUS_FOLDER";
const FOLDER_NAME = "WHControl - Status Draf (otomatis, jangan diubah)";
const MIME_MARKER = "application/json";

let folderIdCache: string | null = null;
let folderPromise: Promise<string> | null = null;

async function findOrCreateFolder(): Promise<string> {
  const q = `mimeType = '${MIME_FOLDER}' and trashed = false and appProperties has { key='${DRAFT_PROP.key}' and value='${FOLDER_KEY}' }`;
  const found = await listDriveFiles(q, 1);
  if (found[0]) return found[0].id;
  const created = await createDriveMetaFile({
    name: FOLDER_NAME,
    mimeType: MIME_FOLDER,
    appProperties: { [DRAFT_PROP.key]: FOLDER_KEY },
  });
  return created.id;
}

async function getFolderId(): Promise<string> {
  if (folderIdCache) return folderIdCache;
  folderPromise ??= findOrCreateFolder()
    .then((id) => {
      folderIdCache = id;
      return id;
    })
    .finally(() => {
      folderPromise = null;
    });
  return folderPromise;
}

async function findMarkers(folderId: string, submissionId: string) {
  const q = `'${escapeDriveQuery(folderId)}' in parents and trashed = false and appProperties has { key='${DRAFT_PROP.key}' and value='${escapeDriveQuery(draftStatusKey(submissionId))}' }`;
  return listDriveFiles(q, 5);
}

/** Simpan/perbarui ringkasan draf. */
export async function upsertDraftStatus(input: DraftStatusInput, args: { subKey: string; device: string; now: number }): Promise<void> {
  const folderId = await getFolderId();
  const props = toDraftProps(input, args);
  const [existing] = await findMarkers(folderId, input.submissionId);
  if (existing) {
    // Draf milik akun lain dengan ID sama tidak boleh ditimpa.
    if (existing.appProperties?.[DRAFT_PROP.sub] !== args.subKey) return;
    await updateDriveAppProperties(existing.id, props);
    return;
  }
  await createDriveMetaFile({
    name: `draf-${input.submissionId}.json`,
    mimeType: MIME_MARKER,
    parents: [folderId],
    appProperties: props,
  });
}

/** Hapus ringkasan draf (laporan terkirim atau draf dibuang). */
export async function removeDraftStatus(submissionId: string, subKey: string): Promise<void> {
  const folderId = await getFolderId();
  const files = await findMarkers(folderId, submissionId);
  for (const f of files) {
    if (f.appProperties?.[DRAFT_PROP.sub] !== subKey) continue;
    await deleteDriveFile(f.id);
  }
}

/** Semua ringkasan draf milik akun. */
export async function listDraftStatuses(subKey: string): Promise<DraftStatus[]> {
  const folderId = await getFolderId();
  const q = `'${escapeDriveQuery(folderId)}' in parents and trashed = false and appProperties has { key='${DRAFT_PROP.sub}' and value='${escapeDriveQuery(subKey)}' }`;
  const files = await listDriveFiles(q, 20);
  return files.map((f) => fromDraftProps(f.appProperties)).filter((s): s is DraftStatus => s !== null);
}
