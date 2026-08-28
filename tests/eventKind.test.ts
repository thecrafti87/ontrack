import { describe, expect, it } from "vitest";
import {
  endeText,
  eventArt,
  istObjekt,
  laeuftNoch,
  zeitraumText,
  zeitraumUeberschneidet,
} from "@/lib/eventKind";

/**
 * Der teure Fehler wäre, „kein Enddatum" als „nicht belegt" zu lesen. Dann
 * meldet die App eine fest verbaute Lampe als frei, jemand plant sie für ein
 * Festival ein, und am Aufbautag hängt sie an einer Decke im Nachbarort.
 */

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("Art", () => {
  it("erkennt das Objekt", () => {
    expect(eventArt("OBJEKT")).toBe("OBJEKT");
    expect(istObjekt("OBJEKT")).toBe(true);
  });

  it("hält alles andere für eine Veranstaltung", () => {
    // Auch Unsinn und Leerwerte — der Normalfall ist die Veranstaltung.
    expect(eventArt("VERANSTALTUNG")).toBe("VERANSTALTUNG");
    expect(eventArt(null)).toBe("VERANSTALTUNG");
    expect(eventArt("QUATSCH")).toBe("VERANSTALTUNG");
    expect(istObjekt(undefined)).toBe(false);
  });
});

describe("Läuft das noch", () => {
  const heute = d("2026-08-28");

  it("ohne Enddatum immer", () => {
    expect(laeuftNoch(null, heute)).toBe(true);
  });

  it("bis einschließlich des letzten Tages", () => {
    expect(laeuftNoch(d("2026-08-28"), heute)).toBe(true);
    expect(laeuftNoch(d("2026-08-29"), heute)).toBe(true);
    expect(laeuftNoch(d("2026-08-27"), heute)).toBe(false);
  });
});

describe("Überschneidung mit einem gesuchten Zeitraum", () => {
  const fensterStart = d("2026-09-01");
  const fensterEnde = d("2026-09-05");

  it("greift bei einem offenen Ende, das vorher begonnen hat", () => {
    // Der wichtigste Fall: Eine Festinstallation aus dem Vorjahr blockiert das
    // Gerät auch für nächsten September.
    expect(zeitraumUeberschneidet(d("2025-01-01"), null, fensterStart, fensterEnde)).toBe(true);
  });

  it("greift nicht, wenn das offene Ende erst später beginnt", () => {
    expect(zeitraumUeberschneidet(d("2026-10-01"), null, fensterStart, fensterEnde)).toBe(false);
  });

  it("rechnet mit geschlossenen Zeiträumen wie bisher", () => {
    expect(zeitraumUeberschneidet(d("2026-08-25"), d("2026-09-02"), fensterStart, fensterEnde)).toBe(
      true
    );
    expect(zeitraumUeberschneidet(d("2026-08-25"), d("2026-08-31"), fensterStart, fensterEnde)).toBe(
      false
    );
    expect(zeitraumUeberschneidet(d("2026-09-06"), d("2026-09-09"), fensterStart, fensterEnde)).toBe(
      false
    );
  });

  it("zählt Berührung am Rand als Überschneidung", () => {
    // Am selben Tag Abbau und Aufbau ist ein Konflikt, kein Zufall.
    expect(zeitraumUeberschneidet(d("2026-08-20"), d("2026-09-01"), fensterStart, fensterEnde)).toBe(
      true
    );
  });
});

describe("Beschriftung", () => {
  const fmt = (x: Date) => x.toISOString().slice(0, 10);

  it("nennt beim offenen Ende keinen Termin, sondern den Zustand", () => {
    expect(endeText(null, fmt)).toBe("läuft");
    expect(zeitraumText(d("2026-03-01"), null, fmt)).toBe("seit 2026-03-01");
  });

  it("nennt sonst den Zeitraum", () => {
    expect(endeText(d("2026-09-05"), fmt)).toBe("2026-09-05");
    expect(zeitraumText(d("2026-09-01"), d("2026-09-05"), fmt)).toBe("2026-09-01 – 2026-09-05");
  });
});
