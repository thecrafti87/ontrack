import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { leseBarcode } from "@/lib/barcode";
import DeviceForm from "../DeviceForm";

export const metadata: Metadata = { title: "Neues Gerät" };

function nextInventoryNumber(existingNumbers: string[]): string {
  let max = 0;
  let digits = 4;
  for (const no of existingNumbers) {
    const match = /^OT-(\d+)$/.exec(no);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
      digits = Math.max(digits, match[1].length);
    }
  }
  const next = max + 1;
  return `OT-${String(next).padStart(digits, "0")}`;
}

/**
 * Neues Gerät — auch als Ziel eines Scans.
 *
 * `?code=` trägt, was der Scanner gelesen hat. Was daraus wird, hängt davon
 * ab, was der Code bedeutet: Ein Produktcode landet im Produktcode-Feld und
 * holt, falls schon ein baugleiches Gerät im Bestand steht, dessen Stammdaten
 * dazu. Alles andere gilt als Seriennummer und bezeichnet nur dieses Gerät.
 */
export default async function NewDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/geraete");

  const { code: rohCode } = await searchParams;
  const gelesen = rohCode ? leseBarcode(rohCode) : null;

  // Vorlage: das erste schon erfasste Gerät derselben Bauart. Wer den achten
  // baugleichen Scheinwerfer anlegt, soll Name und Gewicht nicht abtippen.
  const vorlage = gelesen?.produktcode
    ? await prisma.device.findFirst({
        where: { gtin: gelesen.produktcode },
        select: { name: true, category: true, supplier: true, weightKg: true },
        orderBy: { inventoryNo: "asc" },
      })
    : null;

  const [devices, locations, cases] = await Promise.all([
    prisma.device.findMany({ select: { inventoryNo: true, category: true } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.case.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categories = Array.from(
    new Set(devices.map((d) => d.category).filter((c): c is string => !!c))
  ).sort();

  const suggestedNo = nextInventoryNumber(devices.map((d) => d.inventoryNo));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Neues Gerät</h1>
      {gelesen && (
        <p className="text-sm text-muted mb-4">
          Gescannt: <span className="font-mono text-accent">{gelesen.roh}</span>
          {vorlage && ` · Stammdaten von „${vorlage.name}" übernommen`}
        </p>
      )}
      <div className="mb-6" />
      <div className="card">
        <DeviceForm
          mode="create"
          categories={categories}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          cases={cases.map((c) => ({ id: c.id, name: c.name }))}
          nextInventoryNo={suggestedNo}
          vorbelegung={
            gelesen
              ? {
                  serialNo: gelesen.seriennummer,
                  gtin: gelesen.produktcode,
                  name: vorlage?.name ?? null,
                  category: vorlage?.category ?? null,
                  supplier: vorlage?.supplier ?? null,
                  weightKg: vorlage?.weightKg ?? null,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
