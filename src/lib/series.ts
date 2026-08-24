/**
 * Fortlaufende Inventarnummern für die Serien-Anlage.
 *
 * Acht gleiche Scheinwerfer einzeln anzulegen ist der Reibungspunkt, den man
 * täglich spürt. Die Nummern sollen dabei so weiterzählen, wie ein Mensch es
 * täte: „OT-0007" gefolgt von „OT-0008", nicht von „OT-8".
 */

export const MAX_SERIE = 200;

export type SeriesResult =
  | { ok: true; nummern: string[] }
  | { ok: false; fehler: string };

/**
 * Aus einer Startnummer eine Reihe bilden.
 *
 * Gezählt wird die letzte Ziffernfolge, und ihre Stellenzahl bleibt erhalten —
 * sonst bricht die Sortierung der Geräteliste, die auf gleich langen Nummern
 * beruht. Läuft die Reihe über die Stellenzahl hinaus (etwa 098, 099, 100),
 * wächst sie mit, statt abzuschneiden.
 */
export function buildSeries(start: string, anzahl: number): SeriesResult {
  const basis = start.trim();

  if (!basis) return { ok: false, fehler: "Bitte eine Startnummer angeben." };
  if (!Number.isInteger(anzahl) || anzahl < 1) {
    return { ok: false, fehler: "Die Stückzahl muss mindestens 1 sein." };
  }
  if (anzahl > MAX_SERIE) {
    return { ok: false, fehler: `Höchstens ${MAX_SERIE} Geräte auf einmal.` };
  }

  const treffer = basis.match(/^(.*?)(\d+)(\D*)$/);
  if (!treffer) {
    return {
      ok: false,
      fehler: "Die Startnummer braucht eine Ziffernfolge, ab der gezählt werden kann.",
    };
  }

  const [, prefix, ziffern, suffix] = treffer as unknown as [string, string, string, string];
  const stellen = ziffern.length;
  const startWert = Number(ziffern);

  const nummern: string[] = [];
  for (let i = 0; i < anzahl; i++) {
    const wert = startWert + i;
    // padStart schneidet nichts ab: Wird die Zahl länger als die Vorlage,
    // bleibt sie vollständig.
    nummern.push(`${prefix}${String(wert).padStart(stellen, "0")}${suffix}`);
  }

  return { ok: true, nummern };
}
