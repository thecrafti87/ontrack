import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const MM = 2.8346; // mm → pt

type LabelItem = { name: string; inventoryNo: string };

async function resolveBaseUrl(request: NextRequest): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "appUrl" } });
  const configured = setting?.value?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

function truncateName(name: string): string {
  return name.length > 40 ? `${name.slice(0, 39)}…` : name;
}

/** Bricht Text in max. `maxLines` Zeilen um, kürzt die letzte Zeile bei Bedarf. */
function wrapToLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(attempt, fontSize) <= maxWidth) {
      current = attempt;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        current = "";
        break;
      }
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  return lines.slice(0, maxLines).map((line) => {
    let l = line;
    while (l.length > 1 && font.widthOfTextAtSize(l, fontSize) > maxWidth) {
      l = l.slice(0, -1);
    }
    if (l !== line && l.length > 1) l = `${l.slice(0, -1)}…`;
    return l;
  });
}

type LabelBox = { x: number; y: number; width: number; height: number };

function drawLabel(
  page: PDFPage,
  box: LabelBox,
  item: LabelItem,
  qrPng: PDFImage,
  font: PDFFont,
  boldFont: PDFFont,
  opts: { padding: number; qrSize: number; gap: number; nameFontSize: number; invFontSize: number }
) {
  const { padding, qrSize, gap, nameFontSize, invFontSize } = opts;

  const qrX = box.x + padding;
  const qrY = box.y + (box.height - qrSize) / 2;
  page.drawImage(qrPng, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const textX = qrX + qrSize + gap;
  const textWidth = box.x + box.width - padding - textX;

  const nameLines = wrapToLines(truncateName(item.name), boldFont, nameFontSize, textWidth, 2);
  const lineHeight = nameFontSize * 1.2;
  const invLineHeight = invFontSize * 1.2;
  const invGap = 3;
  const blockHeight = nameLines.length * lineHeight + invGap + invLineHeight;

  // Textblock vertikal im Etikett zentrieren
  let lineTop = box.y + box.height / 2 + blockHeight / 2;

  for (const line of nameLines) {
    const baseline = lineTop - nameFontSize * 0.8;
    page.drawText(line, { x: textX, y: baseline, size: nameFontSize, font: boldFont });
    lineTop -= lineHeight;
  }

  lineTop -= invGap;
  const invBaseline = lineTop - invFontSize * 0.8;
  page.drawText(item.inventoryNo, { x: textX, y: invBaseline, size: invFontSize, font });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const layout = url.searchParams.get("layout") === "a4" ? "a4" : "single";

  const deviceIds: string[] = [];
  const caseIds: string[] = [];
  const order: { type: "d" | "c"; id: string }[] = [];

  for (const raw of idsParam.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    if (part.startsWith("d:")) {
      const id = part.slice(2);
      deviceIds.push(id);
      order.push({ type: "d", id });
    } else if (part.startsWith("c:")) {
      const id = part.slice(2);
      caseIds.push(id);
      order.push({ type: "c", id });
    }
  }

  if (order.length === 0) {
    return NextResponse.json({ error: "Keine Etiketten ausgewählt." }, { status: 400 });
  }

  const [devices, cases] = await Promise.all([
    deviceIds.length > 0
      ? prisma.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true, inventoryNo: true } })
      : Promise.resolve([]),
    caseIds.length > 0
      ? prisma.case.findMany({ where: { id: { in: caseIds } }, select: { id: true, name: true, inventoryNo: true } })
      : Promise.resolve([]),
  ]);

  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const caseMap = new Map(cases.map((c) => [c.id, c]));

  const baseUrl = await resolveBaseUrl(request);

  const items: LabelItem[] = [];
  for (const ref of order) {
    const record = ref.type === "d" ? deviceMap.get(ref.id) : caseMap.get(ref.id);
    if (!record) continue;
    items.push({ name: record.name, inventoryNo: record.inventoryNo });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Etiketten gefunden." }, { status: 404 });
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // QR-PNGs erzeugen und einbetten (einmal pro Etikett)
  const qrImages = await Promise.all(
    items.map(async (item) => {
      const dataUrl = await QRCode.toDataURL(`${baseUrl}/d/${item.inventoryNo}`, {
        margin: 0,
        width: 512,
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(base64, "base64");
      return pdfDoc.embedPng(bytes);
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

    const padding = 3 * MM;
    const qrSize = 28 * MM;
    const gap = 3 * MM;
    const nameFontSize = 8;
    const invFontSize = 8;

    for (let pageStart = 0; pageStart < items.length; pageStart += perPage) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const pageItems = items.slice(pageStart, pageStart + perPage);

      pageItems.forEach((item, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const xLeft = col * labelWidth;
        const yTopFromTop = marginTB + row * labelHeight;
        const yBottom = pageHeight - yTopFromTop - labelHeight;

        drawLabel(
          page,
          { x: xLeft, y: yBottom, width: labelWidth, height: labelHeight },
          item,
          qrImages[pageStart + i],
          font,
          boldFont,
          { padding, qrSize, gap, nameFontSize, invFontSize }
        );
      });
    }
  } else {
    const pageWidth = 62 * MM;
    const pageHeight = 29 * MM;
    const padding = 2 * MM;
    const qrSize = 22 * MM;
    const gap = 2 * MM;
    const nameFontSize = 7.5;
    const invFontSize = 7.5;

    items.forEach((item, i) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawLabel(
        page,
        { x: 0, y: 0, width: pageWidth, height: pageHeight },
        item,
        qrImages[i],
        font,
        boldFont,
        { padding, qrSize, gap, nameFontSize, invFontSize }
      );
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="ontrack-etiketten.pdf"',
    },
  });
}
