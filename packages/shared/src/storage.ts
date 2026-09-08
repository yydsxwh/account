/**
 * 本地文件存储：头像上传与访问 URL。
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function safeFileName(fileName: string) {
  const base = path.basename(fileName || "file").replace(/[^\w.\-]+/g, "_");
  return base.slice(0, 80) || "file";
}

export async function storeUpload(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  kind?: string;
}) {
  const ext = path.extname(safeFileName(input.fileName)) || ".bin";
  const dir = path.join("avatars", input.ownerId);
  const absDir = path.join(UPLOADS_DIR, dir);
  await mkdir(absDir, { recursive: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const rel = `${dir}/${name}`.replaceAll("\\", "/");
  await writeFile(path.join(UPLOADS_DIR, rel), input.buffer);
  return {
    fileUrl: `/uploads/${rel}`,
    fileName: name,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
  };
}

export async function resolveStoredAccessUrl(
  fileUrl: string,
  _options?: { contentDisposition?: string },
) {
  return fileUrl || "";
}
