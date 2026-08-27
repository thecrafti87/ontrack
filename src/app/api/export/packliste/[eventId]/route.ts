import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { exportFilename } from "@/lib/csv";
import { renderTablePdf } from "@/lib/pdfTable";
import {
  EVENT_ITEM_STATUS,
  type EventItemStatus,
  formatDateRange,
  groupByCategory,
} from "@/lib/constants";
import { einsatzBilanz, einsatzStatus, EINSATZ_STATUS_LABEL } from "@/lib/bulk";

/**
 * Packliste eines Events als druckbares PDF.
 *
 * Mit Abhak-Kästchen und nach Kategorien gruppiert — so, wie die Liste beim
 * Verladen tatsächlich benutzt wird. Der Ausdruck ist zugleich die Rückfallebene
 * für den Fall, dass in der Halle kein Empfang ist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      items: {
        include: {
          device: {
            include: {
              location: { select: { name: true } },
              case: { select: { name: true, inventoryNo: true } },
            },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  const gruppen = groupByCategory(event.items, (item) => item.device.category);

  const rows: string[][] = [];
  const groupHeadings = new Map<number, string>();

  for (const gruppe of gruppen) {
    groupHeadings.set(rows.length, `${gruppe.category} (${gruppe.items.length})`);
    const sortiert = [...gruppe.items].sort((a, b) =>
      a.device.inventoryNo.localeCompare(b.device.inventoryNo, "de")
    );
    for (const item of sortiert) {
      rows.push([
        item.device.inventoryNo,
        item.device.name,
        item.device.case ? item.device.case.name : (item.device.location?.name ?? ""),
        item.position ?? "",
        EVENT_ITEM_STATUS[item.status as EventItemStatus]?.label ?? item.status,
      ]);
    }
  }

  // Mengenartikel als eigene Gruppe ans Ende. Sie haben keine Inventarnummer
  // und keine Einsatzposition — aber ein Kästchen zum Abhaken, denn genau das
  // ist der Zweck der ausgedruckten Liste.
  const bulkEintraege = await prisma.eventBulkItem.findMany({
    where: { eventId },
    include: { item: { include: { location: { select: { name: true } } } } },
    orderBy: { item: { name: "asc" } },
  });

  if (bulkEintraege.length > 0) {
    const bewegungen = await prisma.bulkMovement.findMany({
      where: { eventId },
      select: { itemId: true, delta: true, reason: true },
    });

    groupHeadings.set(rows.length, `Kabel & Kleinteile (${bulkEintraege.length})`);
    for (const eintrag of bulkEintraege) {
      const bilanz = einsatzBilanz(bewegungen.filter((b) => b.itemId === eintrag.bulkItemId));
      rows.push([
        "",
        `${eintrag.plannedQty} ${eintrag.item.unit} ${eintrag.item.name}`,
        eintrag.item.location?.name ?? "",
        "",
        EINSATZ_STATUS_LABEL[einsatzStatus(bilanz)],
      ]);
    }
  }

  const zeitraum = formatDateRange(event.startDate, event.endDate);
  const ort = event.venue ? ` · ${event.venue}` : "";

  const pdf = await renderTablePdf(
    {
      title: `Packliste: ${event.name}`,
      subtitle:
        `${zeitraum}${ort} · ${event.items.length} ${event.items.length === 1 ? "Gerät" : "Geräte"}` +
        (bulkEintraege.length > 0 ? ` · ${bulkEintraege.length} Mengenartikel` : ""),
      checkboxes: true,
      columns: [
        { header: "Inventarnr.", width: 1.1 },
        { header: "Gerät", width: 2.6 },
        { header: "Case / Standort", width: 1.5 },
        { header: "Position", width: 1.4 },
        // Breit genug für „Vollständig zurück" — Mengenartikel tragen längere
        // Status-Texte als Geräte, und ein abgeschnittener Status auf einer
        // ausgedruckten Packliste ist wertlos.
        { header: "Status", width: 1.7 },
      ],
      rows,
      groupHeadings,
      footerNote: `OnTrack · ${event.name} · ${zeitraum}`,
    },
    new Date()
  );

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${exportFilename(`packliste-${event.name}`, "pdf", new Date())}"`,
    },
  });
}
