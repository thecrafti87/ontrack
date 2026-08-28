import { beforeEach, describe, expect, it } from "vitest";
import {
  BESCHREIBUNG_MAX,
  KONTAKT_MAX,
  pruefeMeldung,
} from "@/lib/externalReport";
import {
  MAX_REPORTS_PER_ORIGIN,
  WINDOW_MS,
  checkReportAllowed,
  recordReport,
  resetAllLoginFailures,
} from "@/lib/rateLimit";

/**
 * Diese Regeln sitzen an der einzigen Stelle, die ohne Anmeldung schreiben
 * darf. Sie müssen zwei Dinge gleichzeitig können: eine echte Meldung von
 * jemandem annehmen, der die App nicht kennt — und nicht zum Einfallstor
 * werden.
 */

describe("Was angenommen wird", () => {
  it("eine gewöhnliche Meldung", () => {
    const ergebnis = pruefeMeldung({
      code: "OT-0042",
      beschreibung: "Lampe flackert seit gestern",
      kontakt: "hausmeister@stadthalle.de",
    });
    expect(ergebnis).toEqual({
      ok: true,
      werte: {
        code: "OT-0042",
        beschreibung: "Lampe flackert seit gestern",
        kontakt: "hausmeister@stadthalle.de",
      },
    });
  });

  it("eine Meldung ohne Kontakt", () => {
    // Wer den Kontakt erzwingt, bekommt erfundene Adressen statt Meldungen.
    const ergebnis = pruefeMeldung({ code: "OT-1", beschreibung: "geht nicht mehr an" });
    expect(ergebnis.ok && ergebnis.werte.kontakt).toBeNull();
  });

  it("den vollständigen QR-Link statt der nackten Nummer", () => {
    // Gescannt wird die Adresse vom Etikett, nicht die Nummer.
    const ergebnis = pruefeMeldung({
      code: "https://ontrack.example/d/OT-0042",
      beschreibung: "Gehäuse gebrochen",
    });
    expect(ergebnis.ok && ergebnis.werte.code).toBe("OT-0042");
  });

  it("auch eine unbekannte Nummer", () => {
    // Hier wird nicht geprüft, ob es das Gerät gibt: Die öffentliche Seite
    // darf kein Verzeichnis des Bestands werden. Verloren gehen darf die
    // Meldung trotzdem nicht.
    expect(pruefeMeldung({ code: "XYZ-999", beschreibung: "steht seit Wochen dunkel" }).ok).toBe(
      true
    );
  });
});

describe("Was abgewiesen wird", () => {
  it("eine Meldung ohne Gerätenummer", () => {
    const ergebnis = pruefeMeldung({ code: "   ", beschreibung: "irgendwas ist kaputt" });
    expect(ergebnis).toMatchObject({ ok: false, feld: "code" });
  });

  it("eine Meldung, die nichts sagt", () => {
    expect(pruefeMeldung({ code: "OT-1", beschreibung: "x" })).toMatchObject({
      ok: false,
      feld: "beschreibung",
    });
    expect(pruefeMeldung({ code: "OT-1", beschreibung: "   " })).toMatchObject({
      ok: false,
      feld: "beschreibung",
    });
  });

  it("ein Textfeld, mit dem die Datenbank vollgeschrieben wird", () => {
    const ergebnis = pruefeMeldung({ code: "OT-1", beschreibung: "a".repeat(BESCHREIBUNG_MAX + 1) });
    expect(ergebnis).toMatchObject({ ok: false, feld: "beschreibung" });
  });

  it("eine übertrieben lange Gerätenummer", () => {
    expect(pruefeMeldung({ code: "A".repeat(200), beschreibung: "kaputt" })).toMatchObject({
      ok: false,
      feld: "code",
    });
  });
});

describe("Ein zu langer Kontakt", () => {
  it("wird gekürzt, nicht abgelehnt", () => {
    // Eine sonst gute Meldung wegen eines freiwilligen Feldes wegzuwerfen wäre
    // unverhältnismäßig.
    const ergebnis = pruefeMeldung({
      code: "OT-1",
      beschreibung: "Sicherung fliegt raus",
      kontakt: "x".repeat(KONTAKT_MAX + 50),
    });
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.ok && ergebnis.werte.kontakt).toHaveLength(KONTAKT_MAX);
  });
});

describe("Bremse für Meldungen ohne Anmeldung", () => {
  beforeEach(() => resetAllLoginFailures());

  it("lässt die ersten Meldungen durch", () => {
    const jetzt = 1_000_000;
    for (let i = 0; i < MAX_REPORTS_PER_ORIGIN; i++) {
      expect(checkReportAllowed("1.2.3.4", jetzt).allowed).toBe(true);
      recordReport("1.2.3.4", jetzt);
    }
    expect(checkReportAllowed("1.2.3.4", jetzt).allowed).toBe(false);
  });

  it("zählt jede Absendung, nicht nur Fehlschläge", () => {
    // Der Unterschied zur Anmeldebremse: Eine missbräuchliche Meldung sieht
    // aus wie eine echte, es gibt keinen Fehlversuch, an dem man sie erkennt.
    const jetzt = 2_000_000;
    for (let i = 0; i < MAX_REPORTS_PER_ORIGIN; i++) recordReport("5.6.7.8", jetzt);
    expect(checkReportAllowed("5.6.7.8", jetzt).allowed).toBe(false);
  });

  it("bremst andere Herkünfte nicht mit", () => {
    const jetzt = 3_000_000;
    for (let i = 0; i < MAX_REPORTS_PER_ORIGIN; i++) recordReport("1.1.1.1", jetzt);
    expect(checkReportAllowed("2.2.2.2", jetzt).allowed).toBe(true);
  });

  it("gibt nach dem Zeitfenster wieder frei", () => {
    const jetzt = 4_000_000;
    for (let i = 0; i < MAX_REPORTS_PER_ORIGIN; i++) recordReport("9.9.9.9", jetzt);
    expect(checkReportAllowed("9.9.9.9", jetzt + WINDOW_MS + 1).allowed).toBe(true);
  });
});
