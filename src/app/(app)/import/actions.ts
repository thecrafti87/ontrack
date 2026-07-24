"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type ImportRow = {
  name: string;
  inventoryNo?: string;
  category?: string;
  serialNo?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  supplier?: string;
  weightKg?: string;
  notes?: string;
};

export type ImportChunkResult = {
  created: number;
  skipped: number;
  skippedReasons: string[];
};

/** Zahlen mit deutschem Komma tolerieren: "1.299,50" und "1299.50". */
function parseGermanNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  let normalized = value;
  if (normalized.includes(",") && normalized.includes(".")) {
    // Punkt = Tausendertrennzeichen, Komma = Dezimaltrennzeichen
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Datum tolerant parsen: DD.MM.YYYY und YYYY-MM-DD, sonst Fallback auf Date-Parser. */
function parseDateTolerant(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Importiert einen Chunk von CSV-Zeilen. Wird vom Client sequenziell pro Chunk
 * aufgerufen, damit die automatische OT-Nummernvergabe kollisionsfrei fortlaufend bleibt.
 */
export async function importDevicesAction(rows: ImportRow[]): Promise<ImportChunkResult> {
  const user = await requireUser();
  if (!canEdit(user)) {
    return { created: 0, skipped: rows.length, skippedReasons: ["Keine Berechtigung."] };
  }

  const existing = await prisma.device.findMany({ select: { inventoryNo: true, serialNo: true } });
  const inventorySet = new Set(existing.map((d) => d.inventoryNo));
  const serialSet = new Set(
    existing.map((d) => d.serialNo).filter((s): s is string => !!s && s.trim() !== "")
  );

  let maxNo = 0;
  let digits = 4;
  for (const no of inventorySet) {
    const match = /^OT-(\d+)$/.exec(no);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNo) maxNo = n;
      digits = Math.max(digits, match[1].length);
    }
  }

  let created = 0;
  let skipped = 0;
  const skippedReasons: string[] = [];

  function addSkip(reason: string) {
    skipped += 1;
    if (skippedReasons.length < 10) skippedReasons.push(reason);
  }

  for (const row of rows) {
    const name = (row.name ?? "").trim();
    if (!name) {
      addSkip("Zeile ohne Namen übersprungen");
      continue;
    }

    let inventoryNo = (row.inventoryNo ?? "").trim();
    const serialNo = (row.serialNo ?? "").trim() || null;

    if (inventoryNo && inventorySet.has(inventoryNo)) {
      addSkip(`${name}: Inventarnummer ${inventoryNo} bereits vergeben`);
      continue;
    }

    if (serialNo && serialSet.has(serialNo)) {
      addSkip(`${name}: Seriennummer ${serialNo} bereits vergeben`);
      continue;
    }

    if (!inventoryNo) {
      do {
        maxNo += 1;
        inventoryNo = `OT-${String(maxNo).padStart(digits, "0")}`;
      } while (inventorySet.has(inventoryNo));
    }

    await prisma.device.create({
      data: {
        inventoryNo,
        name,
        category: (row.category ?? "").trim() || null,
        serialNo,
        purchaseDate: parseDateTolerant(row.purchaseDate ?? ""),
        purchasePrice: parseGermanNumber(row.purchasePrice ?? ""),
        supplier: (row.supplier ?? "").trim() || null,
        weightKg: parseGermanNumber(row.weightKg ?? ""),
        notes: (row.notes ?? "").trim() || null,
      },
    });

    inventorySet.add(inventoryNo);
    if (serialNo) serialSet.add(serialNo);
    created += 1;
  }

  revalidatePath("/geraete");
  return { created, skipped, skippedReasons };
}

/** Protokolliert den Gesamt-Import einmalig (vom Client nach Verarbeitung aller Chunks aufgerufen). */
export async function logImportSummaryAction(created: number, skipped: number): Promise<void> {
  const user = await requireUser();
  if (!canEdit(user)) return;

  await logActivity({
    userId: user.id,
    action: `CSV-Import: ${created} Geräte angelegt, ${skipped} übersprungen`,
  });
}
