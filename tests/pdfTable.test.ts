import { describe, expect, it } from "vitest";
import { renderTablePdf, toWinAnsi } from "@/lib/pdfTable";

describe("Zeichenersetzung für PDF-Schriften", () => {
  it("lässt Umlaute und Eszett unangetastet", () => {
    // Latin-1 deckt sie ab — sie dürfen nicht verstümmelt werden.
    expect(toWinAnsi("Bühne Größe Ärmel")).toBe("Bühne Größe Ärmel");
  });

  it("ersetzt typografische Anführungszeichen und Gedankenstriche", () => {
    expect(toWinAnsi("„Spot“ – 12–15")).toBe('"Spot" - 12-15');
    expect(toWinAnsi("’s")).toBe("'s");
  });

  it("schreibt das Euro-Zeichen aus", () => {
    // € liegt außerhalb von Latin-1 und würde pdf-lib zum Absturz bringen.
    expect(toWinAnsi("2500 €")).toBe("2500 EUR");
  });

  it("ersetzt schmale und geschützte Leerzeichen durch normale", () => {
    expect(toWinAnsi("12 kg")).toBe("12 kg");
    expect(toWinAnsi("12 kg")).toBe("12 kg");
  });

  it("wirft Zeichen weg, die keine Entsprechung haben, statt zu scheitern", () => {
    expect(toWinAnsi("Halle 東")).toBe("Halle ?");
    expect(toWinAnsi("Lampe 💡")).toMatch(/^Lampe \?+$/);
  });
});

describe("PDF-Tabellensatz", () => {
  const stand = new Date("2026-08-23T10:00:00Z");

  it("erzeugt ein gültiges PDF", async () => {
    const bytes = await renderTablePdf(
      {
        title: "Inventarliste",
        columns: [{ header: "Nr", width: 1 }, { header: "Name", width: 2 }],
        rows: [["OT-0001", "Moving Head"]],
      },
      stand
    );
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("scheitert nicht an Zeichen außerhalb von Latin-1", async () => {
    // Der eigentliche Zweck von toWinAnsi: ein Gerätename mit Emoji oder
    // Euro-Zeichen darf den Druck nicht verhindern.
    await expect(
      renderTablePdf(
        {
          title: "Preise in €",
          columns: [{ header: "Name", width: 1 }],
          rows: [["Lampe 💡 „neu“ — 2500 €"]],
        },
        stand
      )
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("bricht bei vielen Zeilen auf mehrere Seiten um", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => [`OT-${i}`, `Gerät ${i}`]);
    const bytes = await renderTablePdf(
      {
        title: "Lange Liste",
        columns: [{ header: "Nr", width: 1 }, { header: "Name", width: 2 }],
        rows,
      },
      stand
    );
    // pdf-lib legt die Objekte in komprimierten Strömen ab; die Seitenzahl
    // lässt sich nur ermitteln, indem man das Dokument wieder einliest.
    const { PDFDocument } = await import("pdf-lib");
    const geladen = await PDFDocument.load(bytes);
    expect(geladen.getPageCount()).toBeGreaterThan(1);
  });

  it("kommt mit einer leeren Liste zurecht", async () => {
    const bytes = await renderTablePdf(
      { title: "Leer", columns: [{ header: "Nr", width: 1 }], rows: [] },
      stand
    );
    expect(bytes.length).toBeGreaterThan(0);
  });
});
