import {
  SCHUKO_ABSICHERUNG_A,
  ampereAt230V,
  benoetigteKreise,
  type LoadSummary as Summary,
} from "@/lib/load";

/**
 * „1 von 2 Geräten hat …", nicht „1 von 2 Gerät hat …": Das Substantiv steht
 * im Plural, das Verb richtet sich nach der Anzahl. Fehlt der Wert überall,
 * ist die verneinte Form eine andere — „für keines der Geräte ist EIN Gewicht
 * hinterlegt", nicht „kein Gewicht".
 *
 * Das Substantiv kommt von außen, weil in einer Packliste nicht nur Geräte
 * stehen: 40 DMX-Kabel sind eine Position, nicht vierzig Geräte.
 */
function fehlendText(
  ohne: number,
  gesamt: number,
  nomen: "Gewicht" | "Leistung",
  einheit: Einheit
): string {
  const ohneWert = nomen === "Gewicht" ? "kein Gewicht" : "keine Leistung";
  const einWert = nomen === "Gewicht" ? "ein Gewicht" : "eine Leistung";

  if (ohne === gesamt) {
    return gesamt === 1
      ? `Für ${einheit.diesesSingular} ist ${ohneWert} hinterlegt.`
      : `Für ${einheit.keinesPlural} ${gesamt} ${einheit.plural} ist ${einWert} hinterlegt.`;
  }
  return `${ohne} von ${gesamt} ${einheit.dativPlural} ${ohne === 1 ? "hat" : "haben"} ${ohneWert} hinterlegt.`;
}

type Einheit = {
  plural: string;
  dativPlural: string;
  diesesSingular: string;
  keinesPlural: string;
};

const GERAETE: Einheit = {
  plural: "Geräte",
  dativPlural: "Geräten",
  diesesSingular: "dieses Gerät",
  keinesPlural: "keines der",
};

/** Gemischte Packliste: Geräte und Mengenartikel nebeneinander. */
const POSITIONEN: Einheit = {
  plural: "Positionen",
  dativPlural: "Positionen",
  diesesSingular: "diese Position",
  keinesPlural: "keine der",
};

/**
 * Gewicht und Stromlast einer Zusammenstellung.
 *
 * Die Zahl allein wäre gefährlich: Fehlt bei der Hälfte der Geräte das
 * Gewicht, steht hier eine Summe, nach der niemand ein Fahrzeug bestellen
 * sollte. Deshalb steht die Zahl fehlender Angaben gleichberechtigt daneben,
 * nicht als Fußnote.
 */
export function LoadSummaryCard({
  summary,
  titel = "Gewicht & Strom",
  gemischt = false,
}: {
  summary: Summary;
  titel?: string;
  /** Stehen neben Geräten auch Mengenartikel in der Liste? */
  gemischt?: boolean;
}) {
  if (summary.gesamt === 0) return null;

  const ampere = ampereAt230V(summary.leistungW);
  const kreise = benoetigteKreise(summary.leistungW);

  const gewichtVollstaendig = summary.ohneGewicht === 0;
  const leistungVollstaendig = summary.ohneLeistung === 0;
  const gewichtEinheit = gemischt ? POSITIONEN : GERAETE;

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="font-semibold">{titel}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted">Gewicht</p>
          <p className="text-2xl font-bold tabular-nums">
            {gewichtVollstaendig ? "" : "≥ "}
            {summary.gewichtKg.toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg
          </p>
          {!gewichtVollstaendig && (
            <p className="text-xs text-amber-400 mt-1">
              {fehlendText(summary.ohneGewicht, summary.posGesamt, "Gewicht", gewichtEinheit)} Die
              Summe ist entsprechend zu niedrig.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-muted">Anschlussleistung</p>
          <p className="text-2xl font-bold tabular-nums">
            {leistungVollstaendig ? "" : "≥ "}
            {summary.leistungW.toLocaleString("de-DE")} W
          </p>
          {summary.leistungW > 0 && (
            <p className="text-xs text-muted mt-1">
              rund {ampere.toLocaleString("de-DE", { maximumFractionDigits: 1 })} A bei 230 V
              {kreise > 1 && (
                <> · mindestens {kreise} Kreise à {SCHUKO_ABSICHERUNG_A} A</>
              )}
            </p>
          )}
          {!leistungVollstaendig && (
            <p className="text-xs text-amber-400 mt-1">
              {fehlendText(summary.ohneLeistung, summary.stromGesamt, "Leistung", GERAETE)}
            </p>
          )}
        </div>
      </div>

      {summary.leistungW > 0 && (
        <p className="text-xs text-muted">
          Richtwert für einphasige 230-V-Versorgung ohne Gleichzeitigkeitsfaktor und
          ohne Einschaltströme. Für die Auslegung der Einspeisung ersetzt das keine
          Fachplanung.
        </p>
      )}
    </div>
  );
}
