import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildCsv, exportFilename } from "@/lib/csv";
import { renderTablePdf } from "@/lib/pdfTable";
import { formatDate, MAINTENANCE_RESULT, type MaintenanceResult } from "@/lib/constants";
import { pruefnachweise } from "@/lib/maintenance";

/**
 * Prüfnachweise als Sammlung.
 *
 * Für die DGUV-V3-Prüfung ist nicht die Fälligkeitsliste das Dokument, auf das
 * es ankommt, sondern der Nachweis: welches Gerät, wann, von wem, mit welchem
 * Ergebnis. Genau das steht hier — für den ganzen Bestand oder für ein
 * einzelnes Gerät (`?geraet=<id>`, etwa bei einer Übergabe).
 *
 * Bewusst über alle Prüfungen hinweg und nicht nur über die jeweils letzte:
 * Ein Nachweis, der die Vorgeschichte weglässt, beantwortet die Frage nicht,
 * die im Schadensfall gestellt wird.
 */

function resultLabel(result: string): string {
  return MAINTENANCE_RESULT[result as MaintenanceResult]?.label ?? result;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "pdf";
  const deviceId = params.get("geraet");
  const today = new Date();

  const records = await prisma.maintenanceRecord.findMany({
    where: deviceId ? { plan: { deviceId } } : undefined,
    include: {
      plan: {
        include: { device: { select: { id: true, inventoryNo: true, name: true } } },
      },
      recordedBy: { select: { name: true } },
      documents: { select: { id: true } },
    },
    orderBy: [{ performedAt: "desc" }],
  });

  const device = deviceId
    ? await prisma.device.findUnique({
        where: { id: deviceId },
        select: { inventoryNo: true, name: true },
      })
    : null;

  if (deviceId && !device) {
    return NextResponse.json({ error: "Gerät nicht gefunden." }, { status: 404 });
  }

  const zeilen = pruefnachweise(
    records.map((r) => ({
      inventoryNo: r.plan.device.inventoryNo,
      deviceName: r.plan.device.name,
      title: r.plan.title,
      intervalMonths: r.plan.intervalMonths,
      performedAt: r.performedAt,
      result: r.result,
      testerName: r.testerName,
      recordedBy: r.recordedBy.name,
      notes: r.notes,
      documentCount: r.documents.length,
    }))
  );

  const titel = device ? `Prüfnachweise ${device.name}` : "Prüfnachweise";
  const untertitel = device
    ? `${device.inventoryNo} · ${zeilen.length} Prüfung(en) · Stand ${formatDate(today)}`
    : `${zeilen.length} Prüfung(en) · Stand ${formatDate(today)}`;
  const dateiname = device
    ? `ontrack-pruefnachweise-${device.inventoryNo}`
    : "ontrack-pruefnachweise";

  if (format === "csv") {
    const csv = buildCsv(
      [
        "Inventarnummer",
        "Gerät",
        "Prüfung",
        "Geprüft am",
        "Ergebnis",
        "Prüfer",
        "Nächste Fälligkeit",
        "Erfasst von",
        "Dokumente",
        "Notizen",
      ],
      zeilen.map((z) => [
        z.inventoryNo,
        z.deviceName,
        z.title,
        formatDate(z.performedAt),
        resultLabel(z.result),
        z.testerName ?? "",
        z.nextDue ? formatDate(z.nextDue) : "",
        z.recordedBy,
        z.documentCount > 0 ? String(z.documentCount) : "",
        z.notes ?? "",
      ])
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(dateiname, "csv", today)}"`,
      },
    });
  }

  const pdf = await renderTablePdf(
    {
      title: titel,
      subtitle: untertitel,
      landscape: true,
      columns: [
        { header: "Inventarnr.", width: 1.1 },
        { header: "Gerät", width: 2.2 },
        { header: "Prüfung", width: 1.8 },
        { header: "Geprüft am", width: 1.1 },
        { header: "Ergebnis", width: 1.2 },
        { header: "Prüfer", width: 1.7 },
        { header: "Nächste Fälligkeit", width: 1.3 },
        { header: "Notizen", width: 2.2 },
      ],
      rows: zeilen.map((z) => [
        z.inventoryNo,
        z.deviceName,
        z.title,
        formatDate(z.performedAt),
        resultLabel(z.result),
        z.testerName ?? "",
        z.nextDue ? formatDate(z.nextDue) : "—",
        z.notes ?? "",
      ]),
      footerNote:
        "Nachweis der durchgeführten Prüfungen. Angehängte Prüfprotokolle liegen als Dateien in OnTrack am jeweiligen Eintrag.",
    },
    today
  );

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${exportFilename(dateiname, "pdf", today)}"`,
    },
  });
}
