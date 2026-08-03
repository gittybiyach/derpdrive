import { drive_v3, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { createReadStream, createWriteStream } from "fs";
import { readFile, stat } from "fs/promises";
import { basename } from "path";

export function createDrive(client: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: "v3", auth: client });
}

export interface FileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  trashed?: boolean;
}

function formatFile(f: drive_v3.Schema$File): FileInfo {
  return {
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size ?? undefined,
    createdTime: f.createdTime ?? undefined,
    modifiedTime: f.modifiedTime ?? undefined,
    parents: f.parents ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    trashed: f.trashed ?? undefined,
  };
}

export async function listFiles(
  drive: drive_v3.Drive,
  parentId?: string,
  pageSize: number = 50,
): Promise<{ files: FileInfo[]; nextPageToken?: string }> {
  const query = parentId
    ? `'${parentId}' in parents and trashed = false`
    : "trashed = false";

  const res = await drive.files.list({
    q: query,
    pageSize,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed),nextPageToken",
    orderBy: "folder,name_natural",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return {
    files: (res.data.files || []).map(formatFile),
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function readFileContent(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<{ content: string; mimeType: string }> {
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });

  const mimeType = meta.data.mimeType!;

  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export({
      fileId,
      mimeType: "text/plain",
    }, { responseType: "text" });
    return { content: res.data as string, mimeType };
  }

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export({
      fileId,
      mimeType: "text/csv",
    }, { responseType: "text" });
    return { content: res.data as string, mimeType };
  }

  if (mimeType === "application/vnd.google-apps.presentation") {
    const res = await drive.files.export({
      fileId,
      mimeType: "text/plain",
    }, { responseType: "text" });
    return { content: res.data as string, mimeType };
  }

  const res = await drive.files.get({
    fileId,
    alt: "media",
  }, { responseType: "text" });
  return { content: res.data as string, mimeType };
}

// Source formats Drive knows how to import into a native Google type on create.
// requestBody.mimeType must be the TARGET native type for conversion to trigger;
// media.mimeType stays the SOURCE format being uploaded. Conflating the two (the
// original bug here) makes `files.create` store the raw source type literally,
// with no conversion — e.g. a "text/markdown" mimeType creates a plain-text file
// named .md instead of an editable Google Doc.
const NATIVE_CONVERSION_TARGET: Record<string, string> = {
  "text/plain": "application/vnd.google-apps.document",
  "text/markdown": "application/vnd.google-apps.document",
  "text/html": "application/vnd.google-apps.document",
  "text/csv": "application/vnd.google-apps.spreadsheet",
};

export async function writeFile(
  drive: drive_v3.Drive,
  name: string,
  content: string,
  parentId?: string,
  mimeType: string = "text/plain",
  fileId?: string,
): Promise<FileInfo> {
  const media = { mimeType, body: content };

  let res: { data: drive_v3.Schema$File };

  if (fileId) {
    // Updating an existing file never changes its type — Drive imports the new
    // media content into whatever the file already is (verified: updating an
    // existing native Doc with text/markdown media correctly re-converts it).
    res = await drive.files.update({
      fileId,
      media,
      requestBody: { name },
      supportsAllDrives: true,
    });
  } else {
    // Creating new: convert known text formats into an editable native Google
    // type by default (that's what nearly every caller actually wants from a
    // MIME type like "text/markdown"). Anything not in the map (e.g. a native
    // google-apps.* type passed explicitly, or something like application/json)
    // is created literally, unchanged from prior behavior.
    const targetMimeType = NATIVE_CONVERSION_TARGET[mimeType] ?? mimeType;
    const requestBody: drive_v3.Schema$File = { name, mimeType: targetMimeType };
    if (parentId) requestBody.parents = [parentId];

    res = await drive.files.create({
      media,
      requestBody,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
      supportsAllDrives: true,
    });
  }

  return formatFile(res.data);
}

export async function deleteFile(
  drive: drive_v3.Drive,
  fileId: string,
  permanent: boolean = false,
): Promise<void> {
  if (permanent) {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } else {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
  }
}

export async function moveFile(
  drive: drive_v3.Drive,
  fileId: string,
  newParentId?: string,
  newName?: string,
): Promise<FileInfo> {
  const file = await drive.files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true,
  });

  const requestBody: drive_v3.Schema$File = {};
  if (newName) requestBody.name = newName;

  if (newParentId && file.data.parents) {
    const res = await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: file.data.parents.join(","),
      requestBody,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
      supportsAllDrives: true,
    });
    return formatFile(res.data);
  }

  const res = await drive.files.update({
    fileId,
    requestBody,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
    supportsAllDrives: true,
  });
  return formatFile(res.data);
}

export async function copyFile(
  drive: drive_v3.Drive,
  fileId: string,
  name?: string,
  parentId?: string,
): Promise<FileInfo> {
  const requestBody: drive_v3.Schema$File = {};
  if (name) requestBody.name = name;
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.copy({
    fileId,
    requestBody,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
    supportsAllDrives: true,
  });
  return formatFile(res.data);
}

export async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string,
): Promise<FileInfo> {
  const requestBody: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.create({
    requestBody,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
    supportsAllDrives: true,
  });
  return formatFile(res.data);
}

export async function searchFiles(
  drive: drive_v3.Drive,
  query: string,
  pageSize: number = 20,
): Promise<{ files: FileInfo[]; nextPageToken?: string }> {
  const q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;

  const res = await drive.files.list({
    q,
    pageSize,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed),nextPageToken",
    orderBy: "modifiedTime desc",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return {
    files: (res.data.files || []).map(formatFile),
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function getFileInfo(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<FileInfo> {
  const res = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
    supportsAllDrives: true,
  });
  return formatFile(res.data);
}

export async function uploadLocalFile(
  drive: drive_v3.Drive,
  localPath: string,
  parentId?: string,
  name?: string,
): Promise<FileInfo> {
  const stats = await stat(localPath);
  const fileName = name || basename(localPath);

  const requestBody: drive_v3.Schema$File = { name: fileName };
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.create({
    requestBody,
    media: {
      mimeType: "application/octet-stream",
      body: createReadStream(localPath),
    },
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,trashed",
    supportsAllDrives: true,
  });
  return formatFile(res.data);
}

export async function downloadToLocal(
  drive: drive_v3.Drive,
  fileId: string,
  localPath: string,
): Promise<void> {
  const dest = createWriteStream(localPath);
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );
  await new Promise<void>((resolve, reject) => {
    res.data
      .on("end", resolve)
      .on("error", reject)
      .pipe(dest);
  });
}

export async function getRootFolder(
  drive: drive_v3.Drive,
): Promise<FileInfo> {
  const res = await drive.files.get({
    fileId: "root",
    fields: "id,name,mimeType",
  });
  return formatFile(res.data);
}
