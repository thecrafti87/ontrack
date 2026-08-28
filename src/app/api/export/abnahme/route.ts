import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { renderTablePdf } from "@/lib/pdfTable";
import { exportFilename } from "@/lib/csv";
import { formatDate } from "@/lib/constants";
import { getMaintenanceDueDate } from "@/lib/maintenance";
import { erstelleAbnahme, GRUPPE_TITEL, ortVon, type AbnahmeFixture } from "@/lib/abnahme";

/**
 * Abnahmedokumentation einer Anlage als PDF.
 *
 * Das Papier, das am Ende unterschrieben wird. Es sagt, was hängt, wo es
 * hängt, welches Gerät das ist und welche DMX-Adresse es hat — und benennt
 * oben die Vorbehalte, bevor jemand unterschreibt.
 *
 * Die Vorbehalte stehen absichtlich VOR der Tabelle: Was hinter drei Seiten
 * Geräteliste steht, liest niemand mehr, und dann gilt es als abgenommen.
 */

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const eventId = new URL(request.url).searchParams.get("event");
  if (!eventId) {
    return NextResponse.json({ error: "Keine Anlage angegeben." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, venue: true, startDate: true, endDate: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const rows = await prisma.rigFixture.findMany({
    where: { eventId },
    select: {
      name: true,
      fixtureId: true,
      layerName: true,
      dmxAddresses: true,
      installStatus: true,
      actualPosition: true,
      device: {
        select: {
          inventoryNo: true,
          name: true,
          maintenances: { select: { lastDoneAt: true, intervalMonths: true } },
        },
      },
    },
    orderBy: [{ layerName: "asc" }, { name: "asc" }],
  });

  const fixtures: AbnahmeFixture[] = rows.map((f) => {
    // Von mehreren Prüfplänen zählt der, der zuerst fällig wird.
    const faelligkeiten = (f.device?.maintenances ?? [])
      .map((m) => getMaintenanceDueDate(m.lastDoneAt, m.intervalMonths))
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      name: f.name,
      fixtureId: f.fixtureId,
      layerName: f.layerName,
      dmxAddresses: f.dmxAddresses,
      installStatus: f.installStatus,
      actualPosition: f.actualPosition,
      device: f.device ? { inventoryNo: f.device.inventoryNo, name: f.device.name } : null,
      pruefungFaellig: faelligkeiten[0] ?? null,
    };
  });

  const heute = new Date();
  const abnahme = erstelleAbnahme(fixtures, heute);

  const tabellenZeilen: string[][] = [];
  const gruppenTitel = new Map<number, string>();

  for (const gruppe of abnahme.gruppen) {
    gruppenTitel.set(tabellenZeilen.length, `${GRUPPE_TITEL[gruppe.gruppe]} (${gruppe.fixtures.length})`);
    for (const f of gruppe.fixtures) {
      tabellenZeilen.push([
        f.fixtureId ?? "–",
        f.name,
        ortVon(f),
        f.device ? `${f.device.inventoryNo} · ${f.device.name}` : "nicht erfasst",
        f.dmxAddresses ?? "–",
      ]);
    }
  }

  const intro: { text: string; bold?: boolean }[] = [
    {
      text: `Anlage: ${event.name}${event.venue ? ` · ${event.venue}` : ""}`,
    },
    {
      text: `Zeitraum: ${formatDate(event.startDate)} – ${formatDate(event.endDate)} · Stand: ${formatDate(heute)}`,
    },
    {
      text: `${abnahme.zahlen.gesamt} Positionen: ${abnahme.zahlen.montiert} montiert, ${abnahme.zahlen.abweichend} abweichend, ${abnahme.zahlen.offen} offen`,
    },
  ];

  if (abnahme.ohneVorbehalt) {
    intro.push({ text: "Keine Vorbehalte.", bold: true });
  } else {
    intro.push({ text: "Vorbehalte:", bold: true });
    for (const v of abnahme.vorbehalte) intro.push({ text: `- ${v.text}`, bold: true });
  }

  const pdf = await renderTablePdf(
    {
      title: `Abnahme — ${event.name}`,
      columns: [
        { header: "Nr.", width: 0.7 },
        { header: "Position", width: 2.2 },
        { header: "Ort", width: 2.6 },
        { header: "Gerät", width: 3 },
        { header: "DMX", width: 1.2 },
      ],
      rows: tabellenZeilen,
      groupHeadings: gruppenTitel,
      intro,
      signatures: ["Übergeben (Firma, Name, Datum)", "Übernommen (Auftraggeber, Name, Datum)"],
      footerNote: `OnTrack - Abnahme ${event.name}`,
      landscape: true,
    },
    heute
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${exportFilename(`abnahme-${event.name}`, "pdf", heute)}"`,
    },
  });
}
