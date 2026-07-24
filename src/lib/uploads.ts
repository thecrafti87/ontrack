import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);

/** Hochgeladene Datei sicher unter zufälligem Namen speichern, gibt Dateinamen zurück. */
export async function saveUpload(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  if (!ALLOWED_EXT.has(ext)) throw new Error(`Dateityp ${ext} nicht erlaubt`);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

export function uploadPath(filename: string): string {
  // Schutz gegen Pfad-Ausbruch
  const safe = path.basename(filename);
  return path.join(UPLOAD_DIR, safe);
}
