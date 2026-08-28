/**
 * Abnahmedokumentation: was tatsächlich hängt, und was dagegen spricht.
 *
 * Das Dokument, das am Ende einer Festinstallation unterschrieben wird, hat
 * eine einzige Aufgabe: festzuhalten, worüber sich beide Seiten einig sind.
 * Deshalb wird hier **nicht** entschieden, ob abgenommen werden darf — das
 * entscheiden die Menschen, die unterschreiben. Was diese Datei liefert, ist
 * die Sachlage:
 *
 * - Was ist montiert, wie geplant?
 * - Was ist abweichend montiert, und wo?
 * - Was fehlt noch?
 * - Und welche **Vorbehalte** sind zu benennen, bevor jemand unterschreibt?
 *
 * Eine Abweichung ist kein Vorbehalt: Sie ist dokumentiert und damit erledigt.
 * Ein Vorbehalt ist, was das Dokument selbst unvollständig macht — eine nicht
 * montierte Position, ein Platz ohne zugeordnetes Gerät, eine überfällige
 * Prüfung.
 */

export type AbnahmeGruppe = "montiert" | "abweichend" | "offen";

export const GRUPPE_TITEL: Record<AbnahmeGruppe, string> = {
  montiert: "Montiert wie geplant",
  abweichend: "Abweichend montiert",
  offen: "Noch nicht montiert",
};

export type AbnahmeFixture = {
  name: string;
  fixtureId: string | null;
  layerName: string | null;
  dmxAddresses: string | null;
  /** GEPLANT | MONTIERT | ABWEICHEND */
  installStatus: string;
  actualPosition: string | null;
  device: { inventoryNo: string; name: string } | null;
  /** Nächste fällige Prüfung des zugeordneten Geräts, sofern eine geführt wird. */
  pruefungFaellig: Date | null;
};

export type VorbehaltArt = "nicht_montiert" | "ohne_geraet" | "pruefung_faellig";

export type Vorbehalt = {
  art: VorbehaltArt;
  anzahl: number;
  text: string;
};

export function gruppeVon(fixture: AbnahmeFixture): AbnahmeGruppe {
  if (fixture.installStatus === "MONTIERT") return "montiert";
  if (fixture.installStatus === "ABWEICHEND") return "abweichend";
  return "offen";
}

/** Der Ort, den das Dokument nennt: das Tatsächliche, sonst das Geplante. */
export function ortVon(fixture: AbnahmeFixture): string {
  const tatsaechlich = fixture.actualPosition?.trim();
  if (tatsaechlich) return tatsaechlich;
  return fixture.layerName?.trim() || "ohne Angabe";
}

export type Abnahme = {
  gruppen: { gruppe: AbnahmeGruppe; fixtures: AbnahmeFixture[] }[];
  zahlen: { gesamt: number; montiert: number; abweichend: number; offen: number };
  vorbehalte: Vorbehalt[];
  /** Nur eine Zusammenfassung der Vorbehalte, kein Urteil über die Abnahme. */
  ohneVorbehalt: boolean;
};

const REIHENFOLGE: AbnahmeGruppe[] = ["montiert", "abweichend", "offen"];

export function erstelleAbnahme(fixtures: AbnahmeFixture[], heute: Date): Abnahme {
  const nachGruppe = new Map<AbnahmeGruppe, AbnahmeFixture[]>();
  for (const f of fixtures) {
    const g = gruppeVon(f);
    const liste = nachGruppe.get(g);
    if (liste) liste.push(f);
    else nachGruppe.set(g, [f]);
  }

  const gruppen = REIHENFOLGE.filter((g) => (nachGruppe.get(g)?.length ?? 0) > 0).map((g) => ({
    gruppe: g,
    fixtures: nachGruppe.get(g)!,
  }));

  const offen = nachGruppe.get("offen")?.length ?? 0;
  const montiert = nachGruppe.get("montiert")?.length ?? 0;
  const abweichend = nachGruppe.get("abweichend")?.length ?? 0;

  // Nur was montiert ist, gehört in die Abnahme — bei einer noch nicht
  // montierten Position ist das fehlende Gerät keine eigene Beanstandung.
  const verbaut = fixtures.filter((f) => gruppeVon(f) !== "offen");
  const ohneGeraet = verbaut.filter((f) => !f.device).length;
  const pruefungFaellig = verbaut.filter(
    (f) => f.pruefungFaellig != null && f.pruefungFaellig < heute
  ).length;

  const vorbehalte: Vorbehalt[] = [];
  if (offen > 0) {
    vorbehalte.push({
      art: "nicht_montiert",
      anzahl: offen,
      text: `${offen} ${offen === 1 ? "Position ist" : "Positionen sind"} noch nicht montiert.`,
    });
  }
  if (ohneGeraet > 0) {
    vorbehalte.push({
      art: "ohne_geraet",
      anzahl: ohneGeraet,
      text: `Bei ${ohneGeraet} montierten ${
        ohneGeraet === 1 ? "Position" : "Positionen"
      } ist nicht erfasst, welches Gerät dort hängt.`,
    });
  }
  if (pruefungFaellig > 0) {
    vorbehalte.push({
      art: "pruefung_faellig",
      anzahl: pruefungFaellig,
      text: `${pruefungFaellig} ${
        pruefungFaellig === 1 ? "verbautes Gerät hat" : "verbaute Geräte haben"
      } eine überfällige Prüfung.`,
    });
  }

  return {
    gruppen,
    zahlen: { gesamt: fixtures.length, montiert, abweichend, offen },
    vorbehalte,
    ohneVorbehalt: vorbehalte.length === 0,
  };
}
