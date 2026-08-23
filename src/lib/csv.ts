/**
 * CSV-Erzeugung für den Datenexport.
 *
 * Trennzeichen ist das Semikolon und der Datei wird eine Byte-Order-Mark
 * vorangestellt: So öffnet Excel in deutscher Spracheinstellung die Datei ohne
 * Nachfrage und stellt Umlaute richtig dar. Mit Komma und ohne BOM landet alles
 * in einer einzigen Spalte und „Bühne" wird zu „BÃ¼hne".
 *
 * Bewusst frei von Datenbank- und Server-Abhängigkeiten, damit die Regeln
 * einzeln prüfbar bleiben.
 */

export const CSV_DELIMITER = ";";
const BOM = "\uFEFF";

/**
 * Ein einzelnes Feld absichern.
 *
 * In Anführungszeichen gesetzt wird nur, wenn es sein muss — enthält der Wert
 * das Trennzeichen, ein Anführungszeichen oder einen Zeilenumbruch. Enthaltene
 * Anführungszeichen werden verdoppelt.
 */
export function escapeCsvField(value: unknown): string {
  if (value == null) return "";

  let text: string;
  if (value instanceof Date) text = value.toISOString().slice(0, 10);
  else text = String(value);

  // Steuerzeichen entfernen, Zeilenumbrüche im Feld auf Leerzeichen ziehen:
  // ein mehrzeiliges Notizfeld soll die Tabelle nicht zerreißen.
  text = text.replace(/\r\n|\r|\n/g, " ").replace(/[\u0000-\u001F\u007F]/g, "");

  const mussQuoten =
    text.includes(CSV_DELIMITER) || text.includes('"') || text.startsWith(" ") || text.endsWith(" ");

  if (!mussQuoten) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Kopfzeile plus Datenzeilen zu einem CSV-Text zusammensetzen. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(CSV_DELIMITER),
    ...rows.map((row) => row.map(escapeCsvField).join(CSV_DELIMITER)),
  ];
  // CRLF: die Zeilenenden, die Excel und Windows erwarten.
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Dateiname mit Datum, ohne Zeichen, die Betriebssysteme nicht mögen. */
export function exportFilename(base: string, extension: string, today: Date): string {
  const stamp = today.toISOString().slice(0, 10);
  const safe = base
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safe || "export"}-${stamp}.${extension}`;
}
