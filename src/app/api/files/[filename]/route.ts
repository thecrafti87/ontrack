import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSessionUser } from "@/lib/auth";
import { uploadPath } from "@/lib/uploads";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { filename } = await params;
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    const buffer = await readFile(uploadPath(filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }
}
