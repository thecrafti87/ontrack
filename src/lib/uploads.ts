import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Datenverzeichnis: im Desktop-Build zeigt ONTRACK_DATA_DIR in den
// Benutzerordner, sonst gilt wie bisher <cwd>/data (Docker, npm start).
const DATA_DIR = process.env.ONTRACK_DATA_DIR ?? path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

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
