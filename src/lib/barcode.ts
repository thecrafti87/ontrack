/**
 * Was steht eigentlich in einem Barcode?
 *
 * Die kurze Antwort auf „ist Barcode eine universelle Sprache": Das **Lesen**
 * ist universell, die **Bedeutung** ist es nicht. Jeder Scanner liest EAN,
 * UPC, Code 128, Code 39, QR und DataMatrix. Was die gelesenen Zeichen
 * bedeuten, steht nirgends im Code.
 *
 * Für ein Inventar ist genau dieser Unterschied entscheidend:
 *
 * - Ein **Produktcode** (EAN-13, UPC, GTIN) bezeichnet eine **Bauart**, nicht
 *   ein Gerät. Acht baugleiche Scheinwerfer tragen denselben Code. Wer ihn als
 *   Inventarnummer benutzt, kann die acht nie wieder auseinanderhalten.
 * - Eine **Seriennummer** bezeichnet das einzelne Gerät — aber es gibt keine
 *   Norm dafür, was auf dem Etikett steht. Mal nur die Nummer, mal mit
 *   Präfix, mal eine Service-Adresse.
 * - **GS1-128** ist der Sonderfall, in dem beides sauber getrennt drinsteht:
 *   `(01)` Produktcode, `(21)` Seriennummer. Das ist das Nächste an einer
 *   gemeinsamen Sprache, was es gibt — und in der Veranstaltungstechnik
 *   trotzdem die Ausnahme.
 *
 * Deshalb rät diese Datei nicht, sondern ordnet ein — und sagt dazu, wie
 * sicher sie sich ist. Ein Produktcode wird an der Prüfziffer erkannt, nicht
 * an der Länge allein.
 */

export type CodeArt =
  | "produktcode" // EAN-8/12/13/14 mit gültiger Prüfziffer
  | "gs1" // Elementkette mit (01) und/oder (21)
  | "seriennummer" // alles andere: freier Text vom Etikett
  | "adresse"; // eine URL, wie sie unsere eigenen QR-Etiketten tragen

export type GelesenerCode = {
  art: CodeArt;
  /** Der Rohtext, wie er vom Scanner kam — für die Anzeige und zum Nachsehen. */
  roh: string;
  /** Produktcode, falls einer erkannt wurde. Bezeichnet die Bauart. */
  produktcode: string | null;
  /** Seriennummer, falls eine erkannt wurde. Bezeichnet das einzelne Gerät. */
  seriennummer: string | null;
};

/**
 * Modulo-10-Prüfziffer, wie GS1 sie für EAN/UPC/GTIN vorschreibt.
 *
 * Sie ist der Grund, warum man einen Produktcode überhaupt von einer
 * Seriennummer unterscheiden kann: Dreizehn beliebige Ziffern bestehen den
 * Test nur mit einer Wahrscheinlichkeit von eins zu zehn.
 */
export function pruefzifferStimmt(ziffern: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(ziffern)) return false;

  const stellen = ziffern.split("").map(Number);
  const pruef = stellen.pop()!;
  // Von rechts nach links abwechselnd mal 3 und mal 1.
  const summe = stellen.reverse().reduce((s, z, i) => s + z * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

/**
 * Ist der Produktcode aus dem für den internen Gebrauch reservierten Bereich?
 *
 * GS1 vergibt die Präfixe 02 und 20–29 nie an Hersteller; sie sind für
 * Eigenetiketten gedacht. Ein Code daraus sagt also nichts über ein Produkt am
 * Markt aus — nützlich zu wissen, bevor jemand ihn für eine Herstellerangabe
 * hält.
 */
export function istHausinternerCode(produktcode: string): boolean {
  return /^(02|2\d)/.test(produktcode);
}

/** GS1-Elementkette: `(01)0401234567890(21)ABC123` oder ohne Klammern. */
function leseGs1(text: string): { gtin: string | null; serie: string | null } | null {
  const mitKlammern = /\((\d{2})\)([^()]+)/g;
  const gefunden: Record<string, string> = {};
  let treffer: RegExpExecArray | null;
  while ((treffer = mitKlammern.exec(text)) !== null) {
    gefunden[treffer[1]!] = treffer[2]!.trim();
  }
  if (Object.keys(gefunden).length === 0) return null;

  const gtin = gefunden["01"] ?? null;
  const serie = gefunden["21"] ?? null;
  if (!gtin && !serie) return null;
  return { gtin, serie };
}

/**
 * Einen gescannten Text einordnen.
 *
 * Die Reihenfolge ist bewusst: erst die eindeutigen Fälle (eigene Adresse,
 * GS1-Kette), dann der Produktcode über die Prüfziffer, und alles Übrige gilt
 * als Seriennummer. Im Zweifel Seriennummer — das ist die harmlosere
 * Verwechslung, weil eine Seriennummer nur dieses eine Gerät betrifft.
 */
export function leseBarcode(text: string): GelesenerCode {
  const roh = (text ?? "").trim();

  // Unsere eigenen Etiketten tragen die volle Adresse.
  if (/^https?:\/\//i.test(roh) && roh.includes("/d/")) {
    const nummer = decodeURIComponent(roh.slice(roh.indexOf("/d/") + 3)).trim();
    return { art: "adresse", roh, produktcode: null, seriennummer: nummer || null };
  }

  const gs1 = leseGs1(roh);
  if (gs1) {
    // Im Feld (01) steht per Definition ein Produktcode — hier muss nichts
    // geraten werden, das hat der Absender schon ausgezeichnet.
    return { art: "gs1", roh, produktcode: gs1.gtin, seriennummer: gs1.serie };
  }

  const nurZiffern = roh.replace(/[\s-]/g, "");
  if (pruefzifferStimmt(nurZiffern)) {
    return { art: "produktcode", roh, produktcode: nurZiffern, seriennummer: null };
  }

  return { art: "seriennummer", roh, produktcode: null, seriennummer: roh || null };
}

/** Was der Bediener über den gelesenen Code wissen muss, in einem Satz. */
export function codeErklaerung(code: GelesenerCode): string {
  switch (code.art) {
    case "adresse":
      return "Ein OnTrack-Etikett.";
    case "gs1":
      return code.seriennummer
        ? "Ein GS1-Code mit Produkt- und Seriennummer — beides übernommen."
        : "Ein GS1-Code mit Produktnummer.";
    case "produktcode":
      return istHausinternerCode(code.produktcode!)
        ? "Ein Produktcode aus dem hausinternen Bereich. Er bezeichnet die Bauart, nicht dieses eine Gerät."
        : "Ein Produktcode vom Hersteller. Er bezeichnet die Bauart — baugleiche Geräte tragen denselben.";
    case "seriennummer":
      return "Keine Produktnummer erkennbar. Wird als Seriennummer übernommen, also als Kennung dieses einen Geräts.";
  }
}
