import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildCsv, exportFilename } from "@/lib/csv";
import { renderTablePdf } from "@/lib/pdfTable";
import { DEVICE_STATUS, type DeviceStatus, formatDate } from "@/lib/constants";
import { fieldByCode } from "@/lib/fieldCatalog";

/**
 * Vollständiger Export des Gerätebestands.
 *
 * CSV für die Weiterverarbeitung (Versicherung, Steuerberatung, Umzug in ein
 * anderes System), PDF für die Ablage und zum Ausdrucken. Beides bewusst ohne
 * Filter: ein Export soll den ganzen Bestand abbilden, nicht den gerade
 * eingestellten Listenausschnitt.
 */

function statusLabel(status: string): string {
  return DEVICE_STATUS[status as DeviceStatus]?.label ?? status;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const today = new Date();

  const devices = await prisma.device.findMany({
    include: {
      location: { select: { name: true } },
      case: { select: { inventoryNo: true, name: true } },
      fieldValues: true,
      maintenances: { select: { title: true, lastDoneAt: true, intervalMonths: true } },
    },
    orderBy: { inventoryNo: "asc" },
  });

  if (format === "pdf") {
    const pdf = await renderTablePdf(
      {
        title: "Inventarliste",
        subtitle: `${devices.length} Geräte · Stand ${formatDate(today)}`,
        landscape: true,
        columns: [
          { header: "Inventarnr.", width: 1.1 },
          { header: "Name", width: 2.6 },
          { header: "Kategorie", width: 1.3 },
          { header: "Seriennummer", width: 1.5 },
          { header: "Status", width: 1.2 },
          { header: "Standort", width: 1.5 },
          { header: "Case", width: 1.4 },
          { header: "Kaufpreis", width: 1, align: "right" },
        ],
        rows: devices.map((d) => [
          d.inventoryNo,
          d.name,
          d.category ?? "",
          d.serialNo ?? "",
          statusLabel(d.status),
          d.location?.name ?? "",
          d.case ? `${d.case.name} (${d.case.inventoryNo})` : "",
          d.purchasePrice != null ? `${d.purchasePrice.toFixed(2)} EUR` : "",
        ]),
      },
      today
    );

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFilename("ontrack-inventar", "pdf", today)}"`,
      },
    });
  }

  // Zusatzfelder: nur die Spalten aufnehmen, für die es tatsächlich Werte gibt.
  const usedCodes = Array.from(
    new Set(devices.flatMap((d) => d.fieldValues.map((v) => v.fieldCode)))
  ).sort();

  const headers = [
    "Inventarnummer",
    "Name",
    "Kategorie",
    "Seriennummer",
    "Status",
    "Standort",
    "Case",
    "Kaufdatum",
    "Kaufpreis (EUR)",
    "Lieferant",
    "Gewicht (kg)",
    "Notizen",
    "Zuletzt gesehen",
    "Wartungspläne",
    ...usedCodes.map((code) => fieldByCode(code)?.label ?? code),
  ];

  const rows = devices.map((d) => {
    const werte = new Map(d.fieldValues.map((v) => [v.fieldCode, v.value]));
    return [
      d.inventoryNo,
      d.name,
      d.category ?? "",
      d.serialNo ?? "",
      statusLabel(d.status),
      d.location?.name ?? "",
      d.case ? `${d.case.name} (${d.case.inventoryNo})` : "",
      d.purchaseDate ? formatDate(d.purchaseDate) : "",
      d.purchasePrice != null ? d.purchasePrice.toFixed(2).replace(".", ",") : "",
      d.supplier ?? "",
      d.weightKg != null ? String(d.weightKg).replace(".", ",") : "",
      d.notes ?? "",
      d.lastSeenAt ? formatDate(d.lastSeenAt) : "",
      d.maintenances
        .map((m) => `${m.title} (alle ${m.intervalMonths} Mon.)`)
        .join(" | "),
      ...usedCodes.map((code) => werte.get(code) ?? ""),
    ];
  });

  const csv = buildCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("ontrack-inventar", "csv", today)}"`,
    },
  });
}
