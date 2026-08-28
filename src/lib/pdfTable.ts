import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

/**
 * Einfacher Tabellensatz für die druckbaren Listen (Inventar, Packliste).
 *
 * Bewusst schlicht gehalten: Die Listen werden ausgedruckt und mit auf die
 * Baustelle genommen — dort zählt Lesbarkeit, nicht Gestaltung.
 */

const MM = 2.8346; // mm → pt
const A4 = { width: 210 * MM, height: 297 * MM };

const MARGIN = { top: 18 * MM, right: 12 * MM, bottom: 16 * MM, left: 12 * MM };
const ROW_HEIGHT = 6.2 * MM;
const HEADER_HEIGHT = 7 * MM;
const FONT_SIZE = 8.5;
const HEADER_FONT_SIZE = 8;

export type Column = {
  header: string;
  /** Anteil an der verfügbaren Breite; alle Anteile werden normalisiert. */
  width: number;
  align?: "left" | "right";
};

export type TableSpec = {
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: string[][];
  /** Wird links vor jeder Zeile gezeichnet — für Abhak-Kästchen auf Packlisten. */
  checkboxes?: boolean;
  landscape?: boolean;
  /** Zeilen, die eine Gruppe einleiten (Index → Überschrift). */
  groupHeadings?: Map<number, string>;
  footerNote?: string;
  /**
   * Absätze vor der Tabelle — für Angaben, die keine Zeilen sind: Ort, Datum,
   * Vorbehalte. Fett, wo es auffallen soll.
   */
  intro?: { text: string; bold?: boolean }[];
  /**
   * Unterschriftenfelder am Ende. Ein Dokument, das unterschrieben wird,
   * braucht sichtbaren Platz dafür — sonst wird quer über die Tabelle
   * gekritzelt.
   */
  signatures?: string[];
};

/**
 * Zeichen ersetzen, die die eingebauten PDF-Schriften nicht kennen.
 *
 * pdf-lib bricht mit einer Ausnahme ab, sobald ein Zeichen außerhalb von
 * WinAnsi auftaucht. Bei frei eingegebenen Gerätenamen ist das eine Frage der
 * Zeit — deshalb hier abfangen statt den Druck scheitern lassen.
 */
export function toWinAnsi(text: string): string {
  const ersatz: Record<string, string> = {
    "‘": "'", "’": "'", "‚": ",",
    "“": '"', "”": '"', "„": '"',
    "–": "-", "—": "-", "−": "-",
    "\u00A0": " ", "\u202F": " ", "\u2009": " ",
    "…": "...", "•": "-", "€": "EUR",
  };
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (ersatz[ch] !== undefined) {
      out += ersatz[ch];
      continue;
    }
    const code = ch.codePointAt(0)!;
    // WinAnsi deckt Latin-1 ab; alles darüber wird verworfen statt zu sprengen.
    out += code <= 0xff ? ch : "?";
  }
  return out;
}

/** Text auf eine Breite kürzen, mit Auslassungspunkten. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = toWinAnsi(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let cut = clean;
  while (cut.length > 1 && font.widthOfTextAtSize(cut + "...", size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + "...";
}

export async function renderTablePdf(spec: TableSpec, printedAt: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = spec.landscape
    ? { width: A4.height, height: A4.width }
    : { width: A4.width, height: A4.height };

  const contentWidth = pageSize.width - MARGIN.left - MARGIN.right;
  const checkboxWidth = spec.checkboxes ? 6 * MM : 0;
  const tableWidth = contentWidth - checkboxWidth;

  const totalRatio = spec.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = spec.columns.map((c) => (c.width / totalRatio) * tableWidth);

  const ink = rgb(0.1, 0.1, 0.1);
  const soft = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.8, 0.8, 0.8);

  let page: PDFPage;
  let y = 0;
  let pageNumber = 0;

  const startPage = () => {
    page = pdf.addPage([pageSize.width, pageSize.height]);
    pageNumber += 1;
    y = pageSize.height - MARGIN.top;

    if (pageNumber === 1) {
      page.drawText(toWinAnsi(spec.title), {
        x: MARGIN.left, y, size: 15, font: bold, color: ink,
      });
      y -= 6 * MM;
      if (spec.subtitle) {
        page.drawText(toWinAnsi(spec.subtitle), {
          x: MARGIN.left, y, size: 9.5, font: regular, color: soft,
        });
        y -= 6 * MM;
      }
    }

    if (pageNumber === 1 && spec.intro && spec.intro.length > 0) {
      for (const absatz of spec.intro) {
        page.drawText(toWinAnsi(absatz.text), {
          x: MARGIN.left,
          y,
          size: 9,
          font: absatz.bold ? bold : regular,
          color: absatz.bold ? ink : soft,
        });
        y -= 5 * MM;
      }
      y -= 2 * MM;
    }

    drawHeader();
  };

  const drawHeader = () => {
    let x = MARGIN.left + checkboxWidth;
    spec.columns.forEach((col, i) => {
      const w = widths[i]!;
      const label = fit(col.header.toUpperCase(), bold, HEADER_FONT_SIZE, w - 2 * MM);
      const tx = col.align === "right"
        ? x + w - 2 * MM - bold.widthOfTextAtSize(label, HEADER_FONT_SIZE)
        : x;
      page.drawText(label, { x: tx, y, size: HEADER_FONT_SIZE, font: bold, color: soft });
      x += w;
    });
    y -= 2 * MM;
    page.drawLine({
      start: { x: MARGIN.left, y },
      end: { x: pageSize.width - MARGIN.right, y },
      thickness: 0.8,
      color: ink,
    });
    y -= HEADER_HEIGHT - 2 * MM;
  };

  const needsNewPage = (extra = 0) => y - extra < MARGIN.bottom + ROW_HEIGHT;

  startPage();

  spec.rows.forEach((row, index) => {
    const heading = spec.groupHeadings?.get(index);

    if (heading) {
      if (needsNewPage(10 * MM)) startPage();
      y -= 2 * MM;
      page.drawText(toWinAnsi(heading), {
        x: MARGIN.left, y, size: 9.5, font: bold, color: ink,
      });
      y -= 5 * MM;
      page.drawLine({
        start: { x: MARGIN.left, y: y + 1.5 * MM },
        end: { x: pageSize.width - MARGIN.right, y: y + 1.5 * MM },
        thickness: 0.4,
        color: line,
      });
      y -= 1 * MM;
    }

    if (needsNewPage()) startPage();

    if (spec.checkboxes) {
      const boxSize = 3.4 * MM;
      page.drawRectangle({
        x: MARGIN.left,
        y: y - 0.6 * MM,
        width: boxSize,
        height: boxSize,
        borderColor: soft,
        borderWidth: 0.8,
      });
    }

    let x = MARGIN.left + checkboxWidth;
    row.forEach((cell, i) => {
      const w = widths[i] ?? 0;
      const col = spec.columns[i];
      const text = fit(cell ?? "", regular, FONT_SIZE, w - 2 * MM);
      const tx = col?.align === "right"
        ? x + w - 2 * MM - regular.widthOfTextAtSize(text, FONT_SIZE)
        : x;
      page.drawText(text, { x: tx, y, size: FONT_SIZE, font: regular, color: ink });
      x += w;
    });

    y -= ROW_HEIGHT;
  });

  // Unterschriften: zusammenhängend, notfalls auf einer neuen Seite.
  if (spec.signatures && spec.signatures.length > 0) {
    if (y - 26 * MM < MARGIN.bottom) {
      page = pdf.addPage([pageSize.width, pageSize.height]);
      pageNumber += 1;
      y = pageSize.height - MARGIN.top;
    }

    y -= 12 * MM;
    const spaltenBreite = contentWidth / spec.signatures.length;
    spec.signatures.forEach((label, i) => {
      const x = MARGIN.left + i * spaltenBreite;
      page.drawLine({
        start: { x, y },
        end: { x: x + spaltenBreite - 8 * MM, y },
        thickness: 0.8,
        color: ink,
      });
      page.drawText(toWinAnsi(label), {
        x,
        y: y - 4 * MM,
        size: 8,
        font: regular,
        color: soft,
      });
    });
  }

  // Fußzeile auf jeder Seite
  const pages = pdf.getPages();
  const stamp = printedAt.toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  pages.forEach((p, i) => {
    const left = toWinAnsi(spec.footerNote ?? `OnTrack - gedruckt am ${stamp}`);
    const right = `Seite ${i + 1} von ${pages.length}`;
    p.drawText(left, {
      x: MARGIN.left, y: MARGIN.bottom - 5 * MM, size: 7.5, font: regular, color: soft,
    });
    p.drawText(right, {
      x: pageSize.width - MARGIN.right - regular.widthOfTextAtSize(right, 7.5),
      y: MARGIN.bottom - 5 * MM,
      size: 7.5,
      font: regular,
      color: soft,
    });
  });

  return pdf.save();
}
