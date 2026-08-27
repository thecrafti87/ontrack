import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Prüfungen an der Paket-Konfiguration.
 *
 * Diese Fehler haben eine gemeinsame Eigenschaft: Sie existieren **nur im
 * gebauten Artefakt**. Im Quelltext läuft alles, und erst das installierte
 * Programm meldet „Modul nicht gefunden" oder sucht stillschweigend am
 * falschen Ort nach Updates. Ohne diese Tests fiele das frühestens einem
 * Benutzer auf — und der meldet es nicht, er hört einfach auf zu
 * aktualisieren.
 */

const wurzel = process.cwd();

function lies(datei: string): string {
  return fs.readFileSync(path.join(wurzel, datei), "utf8");
}

const paketJson = JSON.parse(lies("package.json"));
const builderYml = lies("electron-builder.yml");
const updatesJs = lies("electron/updates.js");

/** Alle Pakete, die electron-updater zur Laufzeit braucht. */
function abhaengigkeitsBaum(start: string): string[] {
  const gesehen = new Set<string>();

  const gehe = (name: string) => {
    if (gesehen.has(name)) return;
    gesehen.add(name);
    let pj: { dependencies?: Record<string, string> };
    try {
      pj = JSON.parse(lies(path.join("node_modules", name, "package.json")));
    } catch {
      return;
    }
    for (const kind of Object.keys(pj.dependencies ?? {})) gehe(kind);
  };

  gehe(start);
  return [...gesehen].sort();
}

describe("Selbstupdate: Veröffentlichungsort", () => {
  it("führt electron-updater als echte Abhängigkeit, nicht als Entwicklungspaket", () => {
    // Als devDependency landet es nicht im Paket, und das Selbstupdate wäre
    // in jeder gebauten Fassung tot.
    expect(paketJson.dependencies).toHaveProperty("electron-updater");
    expect(paketJson.devDependencies ?? {}).not.toHaveProperty("electron-updater");
  });

  it("nennt in electron-builder.yml dasselbe Repository wie updates.js", () => {
    const owner = builderYml.match(/^\s*owner:\s*(\S+)/m)?.[1];
    const repo = builderYml.match(/^\s*repo:\s*(\S+)/m)?.[1];
    const inCode = updatesJs.match(/owner:\s*"([^"]+)",\s*repo:\s*"([^"]+)"/);

    expect(owner, "owner fehlt in electron-builder.yml").toBeTruthy();
    expect(inCode, "REPO fehlt in electron/updates.js").toBeTruthy();
    expect(owner).toBe(inCode![1]);
    expect(repo).toBe(inCode![2]);
  });

  it("veröffentlicht als Release, nicht als Entwurf", () => {
    // Einen Entwurf sieht weder die App noch die öffentliche API — der Feed
    // bliebe leer und niemand bekäme je ein Update angeboten.
    expect(builderYml).toMatch(/releaseType:\s*release/);
  });

  it("trägt das repository-Feld, das das Packen übersteht", () => {
    // electron-builder streift build, scripts und devDependencies aus der
    // package.json im asar. `repository` bleibt — deshalb ist es der
    // verlässliche Anker, wenn doch einmal zur Laufzeit gesucht wird.
    const feld = paketJson.repository;
    const text = typeof feld === "string" ? feld : (feld?.url ?? "");
    expect(text).toContain("thecrafti87/ontrack");
  });
});

describe("Selbstupdate: was im Paket landen muss", () => {
  const benoetigt = abhaengigkeitsBaum("electron-updater");

  it("kennt überhaupt einen Abhängigkeitsbaum", () => {
    // Schlägt fehl, wenn node_modules fehlt — dann sagt der Test das, statt
    // die folgende Prüfung leer durchlaufen zu lassen.
    expect(benoetigt.length).toBeGreaterThan(1);
  });

  it("nimmt jedes davon ausdrücklich ins Paket auf", () => {
    // electron-builder.yml schließt node_modules pauschal aus. Jedes Modul,
    // das der Hauptprozess braucht, muss danach einzeln wieder hinein.
    const fehlend = benoetigt.filter(
      (name) => !builderYml.includes(`node_modules/${name}/`)
    );

    expect(
      fehlend,
      `Diese Module fehlen in electron-builder.yml → files:\n` +
        fehlend.map((n) => `  - node_modules/${n}/**/*`).join("\n")
    ).toEqual([]);
  });
});

describe("Selbstupdate: Versionsvergleich", () => {
  // Aus updates.js herausgelöst, damit die Regel prüfbar ist, ohne Electron
  // zu starten. Bleibt die Datei die eine Quelle — hier steht eine Kopie der
  // Erwartung, nicht der Logik.
  let istNeuer: (kandidat: string, aktuell: string) => boolean;

  beforeAll(async () => {
    ({ istNeuer } = await import("../electron/updates.js"));
  });

  it("erkennt eine höhere Fassung", () => {
    expect(istNeuer("1.2.0", "1.1.0")).toBe(true);
    expect(istNeuer("1.1.1", "1.1.0")).toBe(true);
    expect(istNeuer("2.0.0", "1.9.9")).toBe(true);
  });

  it("bietet dieselbe oder eine ältere Fassung nicht an", () => {
    expect(istNeuer("1.1.0", "1.1.0")).toBe(false);
    expect(istNeuer("1.0.9", "1.1.0")).toBe(false);
  });

  it("kommt mit dem v davor zurecht", () => {
    // Der Tag heißt v1.2.0, die App kennt nur 1.2.0.
    expect(istNeuer("v1.2.0", "1.1.0")).toBe(true);
  });

  it("vergleicht zahlenweise, nicht als Text", () => {
    // "1.10.0" < "1.9.0" wäre die Antwort eines Textvergleichs — und die App
    // würde ab Fassung 10 nie wieder ein Update finden.
    expect(istNeuer("1.10.0", "1.9.0")).toBe(true);
  });

  it("hält eine Vorabfassung nicht für neuer als die fertige", () => {
    expect(istNeuer("1.2.0-beta.1", "1.2.0")).toBe(false);
    expect(istNeuer("1.2.0", "1.2.0-beta.1")).toBe(true);
  });
});
