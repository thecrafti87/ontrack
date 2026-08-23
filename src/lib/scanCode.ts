/**
 * Auswertung gescannter Codes.
 *
 * Die reine Textzerlegung steht bewusst getrennt von der Datenbankabfrage:
 * So lässt sie sich einzeln prüfen, und der Einsatzmodus kann dieselben
 * Regeln benutzen wie die Scan-Seite, ohne sie zu wiederholen.
 */

/**
 * Aus einem gescannten Text die Inventarnummer herausziehen.
 *
 * QR-Etiketten tragen die volle Adresse (`https://…/d/OT-0001`), NFC-Tags
 * ebenfalls. Hersteller-Barcodes enthalten dagegen nur die nackte Nummer.
 */
export function extractInventoryNo(text: string): string {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const marker = "/d/";
    const at = url.pathname.indexOf(marker);
    if (at !== -1) {
      return decodeURIComponent(url.pathname.slice(at + marker.length)).trim();
    }
  } catch {
    // Kein gültiges Adressformat — der Rohtext ist die Nummer.
  }
  return trimmed;
}
