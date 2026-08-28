/**
 * DMX-Adressen: lesen, suchen, Konflikte finden.
 *
 * Der MVR-Import legt Adressen als Text ab — „2.145", bei mehreren Breaks
 * kommagetrennt. Diese Datei macht daraus etwas Rechenbares.
 *
 * Die Ausgangslage bestimmt, was möglich ist: Der Import speichert den
 * GDTF-Modus als **Text** („Standard 32ch"), nicht die Kanalzahl. Ohne
 * Kanalzahl lässt sich keine Überlappung berechnen — wohl aber, ob zwei
 * Geräte auf derselben Startadresse sitzen. Deshalb zwei Sorten Befund:
 *
 * - **Gleiche Startadresse** — immer sicher, braucht keine Kanalzahl.
 * - **Überlappung** — nur wenn die Kanalzahl bekannt ist.
 *
 * Wo die Kanalzahl fehlt, wird das gesagt und nicht geraten. Eine
 * Konfliktliste, die Überlappungen still übersieht, wäre schlimmer als keine:
 * Sie behauptet, es sei alles geprüft.
 */

export type DmxAdresse = {
  /** 1-basiert, wie am Pult. */
  universum: number;
  /** 1–512. */
  kanal: number;
};

/** Kanäle je Universum — die Grenze, an der ein Gerät überläuft. */
export const KANAELE_JE_UNIVERSUM = 512;

/**
 * Eine Adresse aus Text lesen.
 *
 * Erlaubt sind die Schreibweisen, die im Alltag vorkommen:
 *   „2.145"  „2/145"  „2:145"  „U2.145"   → Universum 2, Kanal 145
 *   „145"                                 → Universum 1, Kanal 145
 *   „657"    (über 512)                   → als absolute Adresse gelesen
 *
 * Die letzte Regel ist die heikle: Eine blanke Zahl über 512 kann nur absolut
 * gemeint sein, denn Kanal 657 gibt es nicht. Darunter ist „145" fast immer
 * der Kanal im ersten Universum — so tippt es jeder am Pult.
 */
export function parseAdresse(text: string | null | undefined): DmxAdresse | null {
  const roh = (text ?? "").trim();
  if (!roh) return null;

  const geteilt = roh.match(/^[uU]?\s*(\d+)\s*[./:]\s*(\d+)$/);
  if (geteilt) {
    const universum = Number.parseInt(geteilt[1]!, 10);
    const kanal = Number.parseInt(geteilt[2]!, 10);
    if (universum < 1 || kanal < 1 || kanal > KANAELE_JE_UNIVERSUM) return null;
    return { universum, kanal };
  }

  const blank = roh.match(/^(\d+)$/);
  if (!blank) return null;
  const zahl = Number.parseInt(blank[1]!, 10);
  if (zahl < 1) return null;

  if (zahl <= KANAELE_JE_UNIVERSUM) return { universum: 1, kanal: zahl };

  return {
    universum: Math.floor((zahl - 1) / KANAELE_JE_UNIVERSUM) + 1,
    kanal: ((zahl - 1) % KANAELE_JE_UNIVERSUM) + 1,
  };
}

/** Das gespeicherte Feld eines Fixtures: „1.1, 2.145" → mehrere Adressen. */
export function parseAdressliste(feld: string | null | undefined): DmxAdresse[] {
  if (!feld) return [];
  return feld
    .split(",")
    .map((teil) => parseAdresse(teil))
    .filter((a): a is DmxAdresse => a !== null);
}

export function formatAdresse(adresse: DmxAdresse): string {
  return `${adresse.universum}.${adresse.kanal}`;
}

/** Fortlaufende Nummer über alle Universen — nur zum Sortieren und Vergleichen. */
export function absoluteAdresse(adresse: DmxAdresse): number {
  return (adresse.universum - 1) * KANAELE_JE_UNIVERSUM + adresse.kanal;
}

/**
 * Kanalzahl aus dem Modusnamen lesen.
 *
 * GDTF-Modi heißen in der Praxis „32ch", „Mode 16", „Standard 8 Kanal",
 * „Extended_24Ch". Eine Zahl mit Kanal-Hinweis daneben ist verlässlich genug,
 * um sie als **Vermutung** zu verwenden — als solche wird sie auch angezeigt.
 *
 * Eine nackte Zahl ohne Hinweis wird NICHT genommen: „Mode 2" ist der zweite
 * Modus, nicht ein Zweikanäler. Diese Verwechslung würde Konflikte erfinden,
 * die es nicht gibt — und das ist schlimmer als eine Lücke.
 */
export function kanaeleAusModus(modus: string | null | undefined): number | null {
  const text = (modus ?? "").trim();
  if (!text) return null;

  const treffer = text.match(/(\d+)\s*(?:ch\b|channels?\b|kanal|kanäle|kan\b|k\b)/i);
  if (!treffer) return null;

  const zahl = Number.parseInt(treffer[1]!, 10);
  if (!Number.isFinite(zahl) || zahl < 1 || zahl > KANAELE_JE_UNIVERSUM) return null;
  return zahl;
}

/**
 * Woher die Kanalzahl stammt — gehört zur Anzeige, nicht in die Fußnote.
 *
 * - `gdtf`      aus der Gerätedatei im MVR gelesen: verlässlich.
 * - `modus`     aus dem Modusnamen geraten: meistens richtig.
 * - `unbekannt` nicht ermittelbar: dieses Gerät fehlt in der Überlappungsprüfung.
 */
export type KanalQuelle = "gdtf" | "modus" | "unbekannt";

export type Belegung = {
  /** Fixture-Kennung, für die Rückverlinkung. */
  id: string;
  name: string;
  /** Das zugeordnete Gerät im Bestand — fehlt, solange nichts zugeordnet ist. */
  geraeteId: string | null;
  inventarnummer: string | null;
  /** Layer oder Traverse — sagt vor Ort mehr als eine Kennung. */
  ort: string | null;
  adresse: DmxAdresse;
  kanaele: number | null;
  kanalQuelle: KanalQuelle;
};

export type Konflikt =
  | {
      art: "gleiche_adresse";
      universum: number;
      kanal: number;
      beteiligte: Belegung[];
    }
  | {
      art: "ueberlappung";
      universum: number;
      /** Der überlappende Bereich, nicht die ganzen Geräte. */
      von: number;
      bis: number;
      beteiligte: [Belegung, Belegung];
    }
  | {
      art: "ueberlauf";
      universum: number;
      /** Bis wohin das Gerät reichen würde. */
      bis: number;
      beteiligte: [Belegung];
    };

/** Letzter belegter Kanal, oder null wenn die Kanalzahl fehlt. */
export function letzterKanal(belegung: Belegung): number | null {
  if (belegung.kanaele == null) return null;
  return belegung.adresse.kanal + belegung.kanaele - 1;
}

/**
 * Konflikte finden.
 *
 * Reihenfolge der Befunde ist bewusst: Gleiche Startadresse zuerst, weil
 * sicher; danach Überlappungen; zuletzt Überläufe über das Universum hinaus.
 *
 * Geprüft wird nur innerhalb eines Universums — zwei Geräte auf Kanal 100 in
 * Universum 1 und 2 stören sich nicht.
 */
export function findeKonflikte(belegungen: Belegung[]): Konflikt[] {
  const konflikte: Konflikt[] = [];

  const nachUniversum = new Map<number, Belegung[]>();
  for (const b of belegungen) {
    const liste = nachUniversum.get(b.adresse.universum);
    if (liste) liste.push(b);
    else nachUniversum.set(b.adresse.universum, [b]);
  }

  for (const [universum, liste] of [...nachUniversum.entries()].sort((a, b) => a[0] - b[0])) {
    const sortiert = [...liste].sort((a, b) => a.adresse.kanal - b.adresse.kanal);

    // 1) Gleiche Startadresse — der eindeutige Fall.
    const nachKanal = new Map<number, Belegung[]>();
    for (const b of sortiert) {
      const gruppe = nachKanal.get(b.adresse.kanal);
      if (gruppe) gruppe.push(b);
      else nachKanal.set(b.adresse.kanal, [b]);
    }
    for (const [kanal, gruppe] of [...nachKanal.entries()].sort((a, b) => a[0] - b[0])) {
      if (gruppe.length < 2) continue;
      konflikte.push({ art: "gleiche_adresse", universum, kanal, beteiligte: gruppe });
    }

    // 2) Überlappung — nur mit bekannter Kanalzahl auf beiden Seiten.
    for (let i = 0; i < sortiert.length; i++) {
      const a = sortiert[i]!;
      const endeA = letzterKanal(a);
      if (endeA == null) continue;

      for (let j = i + 1; j < sortiert.length; j++) {
        const b = sortiert[j]!;
        // Sortiert nach Startkanal: Beginnt b hinter dem Ende von a, tun es
        // alle folgenden auch.
        if (b.adresse.kanal > endeA) break;
        if (letzterKanal(b) == null) continue;
        // Gleiche Startadresse ist oben schon gemeldet.
        if (a.adresse.kanal === b.adresse.kanal) continue;

        konflikte.push({
          art: "ueberlappung",
          universum,
          von: b.adresse.kanal,
          bis: Math.min(endeA, letzterKanal(b)!),
          beteiligte: [a, b],
        });
      }
    }

    // 3) Überlauf über das Universum hinaus.
    for (const b of sortiert) {
      const ende = letzterKanal(b);
      if (ende != null && ende > KANAELE_JE_UNIVERSUM) {
        konflikte.push({ art: "ueberlauf", universum, bis: ende, beteiligte: [b] });
      }
    }
  }

  return konflikte;
}

/**
 * Wie viele Belegungen sich mangels Kanalzahl nicht auf Überlappung prüfen
 * lassen.
 *
 * Gehört neben jede Konfliktliste: „keine Konflikte" heißt sonst etwas
 * anderes, als der Leser versteht.
 */
export function ungeprueft(belegungen: Belegung[]): number {
  return belegungen.filter((b) => b.kanaele == null).length;
}

/** Die Felder, die aus einem RigFixture gebraucht werden — bewusst ohne Prisma-Typ. */
export type FixtureRohdaten = {
  id: string;
  name: string;
  dmxAddresses: string | null;
  gdtfMode: string | null;
  gdtfChannels?: number | null;
  layerName: string | null;
  actualPosition: string | null;
  device: { id: string; inventoryNo: string } | null;
};

/**
 * Aus den importierten Fixtures Belegungen machen.
 *
 * Ein Fixture kann mehrere Breaks haben („1.1, 2.145") — jeder Break ist eine
 * eigene Belegung, denn jeder kann für sich kollidieren.
 *
 * Für den Ort gilt: Was tatsächlich verbaut wurde, schlägt den Layer aus der
 * Zeichnung. Wer vor Ort sucht, will wissen, wo das Gerät hängt, nicht in
 * welcher Ebene es gezeichnet war.
 */
export function belegungenAus(fixtures: FixtureRohdaten[]): Belegung[] {
  const belegungen: Belegung[] = [];

  for (const f of fixtures) {
    // Die Kanalzahl aus der GDTF-Datei ist gemessen, die aus dem Modusnamen
    // geraten. Deshalb hat die gemessene Vorrang.
    const ausDatei =
      f.gdtfChannels != null && f.gdtfChannels > 0 && f.gdtfChannels <= KANAELE_JE_UNIVERSUM
        ? f.gdtfChannels
        : null;
    const kanaele = ausDatei ?? kanaeleAusModus(f.gdtfMode);
    const kanalQuelle: KanalQuelle =
      ausDatei != null ? "gdtf" : kanaele != null ? "modus" : "unbekannt";

    for (const adresse of parseAdressliste(f.dmxAddresses)) {
      belegungen.push({
        id: f.id,
        name: f.name,
        geraeteId: f.device?.id ?? null,
        inventarnummer: f.device?.inventoryNo ?? null,
        ort: f.actualPosition?.trim() || f.layerName || null,
        adresse,
        kanaele,
        kanalQuelle,
      });
    }
  }

  return belegungen;
}

export type Fundstelle = {
  /** Geräte, deren Startadresse genau dieser Kanal ist. */
  genau: Belegung[];
  /**
   * Geräte, die diesen Kanal mitbenutzen, ohne dort zu beginnen. Nur
   * auffindbar, wenn die Kanalzahl bekannt ist.
   */
  imBereich: Belegung[];
};

/**
 * Wer sitzt auf dieser Adresse?
 *
 * Die eigentliche Frage vor Ort: „Kanal 145 im zweiten Universum zuckt — was
 * ist das und wo hängt es?" Die Antwort hat zwei Teile, weil der Kanal auch zu
 * einem Gerät gehören kann, das weiter vorne beginnt.
 */
export function findeBelegung(belegungen: Belegung[], gesucht: DmxAdresse): Fundstelle {
  const genau: Belegung[] = [];
  const imBereich: Belegung[] = [];

  for (const b of belegungen) {
    if (b.adresse.universum !== gesucht.universum) continue;

    if (b.adresse.kanal === gesucht.kanal) {
      genau.push(b);
      continue;
    }

    const ende = letzterKanal(b);
    if (ende == null) continue;
    if (b.adresse.kanal < gesucht.kanal && gesucht.kanal <= ende) imBereich.push(b);
  }

  const nachKanal = (a: Belegung, b: Belegung) => a.adresse.kanal - b.adresse.kanal;
  return { genau: genau.sort(nachKanal), imBereich: imBereich.sort(nachKanal) };
}
