import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  freierName,
  leseArgumente,
  raeumeAuf,
  sichereUploads,
  zeitstempel,
} from "../scripts/backup.mjs";

/**
 * Die Sicherung selbst (VACUUM INTO) ist SQLites Sache und hier nicht zu
 * prüfen. Prüfenswert ist alles, was drumherum entscheidet, welche Datei
 * geschrieben und welche gelöscht wird — dort verliert man Daten, nicht im
 * VACUUM.
 */

let ordner: string;

beforeEach(() => {
  ordner = fs.mkdtempSync(path.join(os.tmpdir(), "ontrack-backup-test-"));
});

afterEach(() => {
  fs.rmSync(ordner, { recursive: true, force: true });
});

function lege(...namen: string[]) {
  for (const name of namen) fs.writeFileSync(path.join(ordner, name), "x");
}

describe("Dateiname der Sicherung", () => {
  it("ist sortierbar und ohne Doppelpunkte", () => {
    // Doppelpunkte sind unter Windows in Dateinamen nicht erlaubt.
    const name = zeitstempel(new Date("2026-08-27T11:35:41.000Z"));
    expect(name).toBe("2026-08-27T11-35-41");
  });

  it("ordnet Zeitstempel alphabetisch wie zeitlich", () => {
    const frueher = zeitstempel(new Date("2026-08-27T09:00:00Z"));
    const spaeter = zeitstempel(new Date("2026-08-27T11:00:00Z"));
    expect([spaeter, frueher].sort()).toEqual([frueher, spaeter]);
  });

  it("weicht aus, wenn in derselben Sekunde schon gesichert wurde", () => {
    lege("ontrack-2026-08-27T11-35-41.db");
    expect(path.basename(freierName(ordner, "2026-08-27T11-35-41"))).toBe(
      "ontrack-2026-08-27T11-35-41-2.db"
    );
  });
});

describe("Aufräumen alter Stände", () => {
  it("behält die jüngsten und löscht den Rest", () => {
    lege(
      "ontrack-2026-08-20T10-00-00.db",
      "ontrack-2026-08-21T10-00-00.db",
      "ontrack-2026-08-22T10-00-00.db",
      "ontrack-2026-08-23T10-00-00.db"
    );

    expect(raeumeAuf(ordner, 2)).toBe(2);
    expect(fs.readdirSync(ordner).sort()).toEqual([
      "ontrack-2026-08-22T10-00-00.db",
      "ontrack-2026-08-23T10-00-00.db",
    ]);
  });

  it("löscht nichts, solange die Zahl nicht überschritten ist", () => {
    lege("ontrack-2026-08-20T10-00-00.db");
    expect(raeumeAuf(ordner, 14)).toBe(0);
    expect(fs.readdirSync(ordner)).toHaveLength(1);
  });

  it("lässt fremde Dateien in Ruhe", () => {
    // Der Zielordner gehört womöglich nicht uns allein. Was nicht nach einer
    // OnTrack-Sicherung aussieht, wird nicht angefasst.
    lege(
      "ontrack-2026-08-20T10-00-00.db",
      "ontrack-2026-08-21T10-00-00.db",
      "urlaubsfotos.zip",
      "ontrack.db"
    );

    raeumeAuf(ordner, 1);

    const uebrig = fs.readdirSync(ordner).sort();
    expect(uebrig).toContain("urlaubsfotos.zip");
    expect(uebrig).toContain("ontrack.db");
    expect(uebrig).toContain("ontrack-2026-08-21T10-00-00.db");
    expect(uebrig).not.toContain("ontrack-2026-08-20T10-00-00.db");
  });

  it("erfasst auch die Ausweichnamen derselben Sekunde", () => {
    lege(
      "ontrack-2026-08-20T10-00-00.db",
      "ontrack-2026-08-20T10-00-00-2.db",
      "ontrack-2026-08-21T10-00-00.db"
    );
    expect(raeumeAuf(ordner, 1)).toBe(2);
  });
});

describe("Uploads übertragen", () => {
  it("kopiert nur, was noch nicht da ist", () => {
    const quelle = path.join(ordner, "uploads");
    const ziel = path.join(ordner, "sicherung");
    fs.mkdirSync(quelle);
    fs.writeFileSync(path.join(quelle, "a.jpg"), "eins");
    fs.writeFileSync(path.join(quelle, "b.jpg"), "zwei");

    expect(sichereUploads(quelle, ziel)).toEqual({ kopiert: 2, uebersprungen: 0 });

    fs.writeFileSync(path.join(quelle, "c.jpg"), "drei");
    expect(sichereUploads(quelle, ziel)).toEqual({ kopiert: 1, uebersprungen: 2 });
  });

  it("kommt ohne Upload-Ordner zurecht", () => {
    // Eine frische Installation hat noch keine Fotos.
    expect(sichereUploads(path.join(ordner, "gibtesnicht"), path.join(ordner, "ziel"))).toEqual({
      kopiert: 0,
      uebersprungen: 0,
    });
  });
});

describe("Schalter", () => {
  it("versteht Ziel, Anzahl und Uploads-Verzicht", () => {
    expect(leseArgumente(["--ziel", "/tmp/x", "--behalten", "7", "--ohne-uploads"])).toEqual({
      ziel: "/tmp/x",
      behalten: "7",
      uploads: false,
    });
  });

  it("meldet unbekannte Schalter, statt sie zu verschlucken", () => {
    // Ein vertipptes --behlaten würde sonst still auf den Standard zurückfallen
    // und man behielte 14 Stände statt der gewünschten 60.
    expect(() => leseArgumente(["--behlaten", "60"])).toThrow(/Unbekannter Schalter/);
  });
});
