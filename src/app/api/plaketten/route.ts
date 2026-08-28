import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { monatJahr, teilePlaketten, type Plakette } from "@/lib/pruefplakette";

/**
 * Prüfplaketten als PDF.
 *
 * Bewusst auf denselben Etikettenformaten wie die Inventaretiketten
 * (`/api/etiketten`): Wer OnTrack benutzt, soll eine Sorte Etikettenbogen
 * kaufen müssen und nicht zwei.
 *
 * Welche Geräte eine Plakette bekommen, entscheidet `teilePlaketten` — die
 * Regel gehört nicht in eine Zeichenroutine. Abgelehnte Geräte werden im
 * Antwort-Header genannt, damit der Aufrufer sie melden kann, statt dass
 * jemand die fehlenden Plaketten erst beim Kleben bemerkt.
 */

const MM = 2.8346; // mm → pt

async function resolveBaseUrl(request: NextRequest): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "appUrl" } });
  const configured = setting?.value?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

function kuerze(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Eine Plakette zeichnen.
 *
 * Die Anordnung folgt dem, was jemand vor dem Gerät wissen will, in dieser
 * Reihenfolge: Bis wann gilt das? Was ist das für eine Prüfung? Wer war das?
 * Deshalb steht die nächste Fälligkeit groß und alles andere klein.
 */
function zeichnePlakette(
  page: PDFPage,
  box: Box,
  p: Plakette,
  qr: PDFImage,
  font: PDFFont,
  bold: PDFFont,
  masse: { padding: number; qrSize: number; gap: number }
) {
  const { padding, qrSize, gap } = masse;

  page.drawRectangle({
    ...box,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.5,
  });

  const qrX = box.x + box.width - padding - qrSize;
  const qrY = box.y + (box.height - qrSize) / 2;
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const textX = box.x + padding;
  const textBreite = qrX - gap - textX;

  let oben = box.y + box.height - padding;

  // Zeile 1: worum es geht
  const titel = kuerze(p.titel.toUpperCase(), bold, 6, textBreite);
  page.drawText(titel, { x: textX, y: oben - 6, size: 6, font: bold });
  oben -= 6 + 3;

  // Zeile 2: die Aussage, auf die es ankommt
  page.drawText("Nächste Prüfung", { x: textX, y: oben - 6, size: 6, font });
  oben -= 6 + 1;
  page.drawText(monatJahr(p.naechsteFaellig), { x: textX, y: oben - 14, size: 14, font: bold });
  oben -= 14 + 3;

  // Zeile 3: Beleg — wann und von wem
  const geprueft = `geprüft ${monatJahr(p.geprueftAm)}${p.pruefer ? ` · ${p.pruefer}` : ""}`;
  page.drawText(kuerze(geprueft, font, 5.5, textBreite), {
    x: textX,
    y: oben - 5.5,
    size: 5.5,
    font,
  });
  oben -= 5.5 + 2;

  // Zeile 4: um welches Gerät es geht
  page.drawText(kuerze(p.inventoryNo, bold, 7, textBreite), {
    x: textX,
    y: box.y + padding,
    size: 7,
    font: bold,
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.approved) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const layout = params.get("layout") === "single" ? "single" : "a4";
  const planIds = (params.get("plaene") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (planIds.length === 0) {
    return NextResponse.json({ error: "Keine Prüfung ausgewählt." }, { status: 400 });
  }

  const plans = await prisma.maintenancePlan.findMany({
    where: { id: { in: planIds } },
    include: {
      device: { select: { inventoryNo: true, name: true } },
      records: { orderBy: { performedAt: "desc" }, take: 1, select: { result: true, testerName: true } },
    },
  });

  // Reihenfolge der Anfrage beibehalten — sie entspricht der Auswahl auf dem
  // Bildschirm, und beim Kleben arbeitet man den Bogen der Reihe nach ab.
  const nachId = new Map(plans.map((p) => [p.id, p]));
  const sortiert = planIds.map((id) => nachId.get(id)).filter((p): p is (typeof plans)[number] => !!p);

  // „Nicht gefunden" und „darf nicht gedruckt werden" sind zwei verschiedene
  // Auskünfte — die zweite schickt jemanden auf die Suche nach einer
  // durchgefallenen Prüfung, die es gar nicht gibt.
  if (sortiert.length === 0) {
    return NextResponse.json({ error: "Keine der gewählten Prüfungen gefunden." }, { status: 404 });
  }

  const { druckbar, abgelehnt } = teilePlaketten(
    sortiert.map((plan) => ({
      id: plan.id,
      inventoryNo: plan.device.inventoryNo,
      deviceName: plan.device.name,
      titel: plan.title,
      intervalMonths: plan.intervalMonths,
      lastDoneAt: plan.lastDoneAt,
      letztesErgebnis: plan.records[0]?.result ?? null,
      pruefer: plan.records[0]?.testerName ?? null,
    }))
  );

  if (druckbar.length === 0) {
    return NextResponse.json(
      {
        error: "Für keine der gewählten Prüfungen darf eine Plakette gedruckt werden.",
        abgelehnt,
      },
      { status: 409 }
    );
  }

  const baseUrl = await resolveBaseUrl(request);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const qrBilder = await Promise.all(
    druckbar.map(async (p) => {
      const dataUrl = await QRCode.toDataURL(`${baseUrl}/d/${p.inventoryNo}`, {
        margin: 0,
        width: 512,
      });
      return pdfDoc.embedPng(Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
    })
  );

  if (layout === "a4") {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const labelWidth = 70 * MM;
    const labelHeight = 33.9 * MM;
    const marginTB = 13.55 * MM;
    const cols = 3;
    const rows = 8;
    const perPage = cols * rows;
    const masse = { padding: 3 * MM, qrSize: 22 * MM, gap: 2 * MM };

    for (let start = 0; start < druckbar.length; start += perPage) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      druckbar.slice(start, start + perPage).forEach((p, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        zeichnePlakette(
          page,
          {
            x: col * labelWidth,
            y: pageHeight - marginTB - row * labelHeight - labelHeight,
            width: labelWidth,
            height: labelHeight,
          },
          p,
          qrBilder[start + i]!,
          font,
          bold,
          masse
        );
      });
    }
  } else {
    const pageWidth = 62 * MM;
    const pageHeight = 29 * MM;
    const masse = { padding: 2 * MM, qrSize: 19 * MM, gap: 2 * MM };

    druckbar.forEach((p, i) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      zeichnePlakette(
        page,
        { x: 0, y: 0, width: pageWidth, height: pageHeight },
        p,
        qrBilder[i]!,
        font,
        bold,
        masse
      );
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="ontrack-pruefplaketten.pdf"',
      // Der Aufrufer soll sagen können, wer fehlt — ohne die Liste erneut zu laden.
      "X-Plaketten-Gedruckt": String(druckbar.length),
      "X-Plaketten-Abgelehnt": String(abgelehnt.length),
    },
  });
}
