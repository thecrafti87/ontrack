import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// CommonJS-Modul der Desktop-App — bewusst ohne eigene Typdefinition.
import { splitStatements } from "../electron/migrate.js";

/**
 * Der Migrationslauf der Desktop-App führt die von Prisma erzeugten
 * SQL-Dateien selbst aus, weil die Prisma-CLI nicht mitgeliefert werden kann.
 * Die Zerlegung in Einzelanweisungen ist dabei der heikle Teil: ein simples
 * split(";") zerbricht an Semikolons in Zeichenketten und verstümmelt dann
 * eine Tabellendefinition.
 */
describe("Zerlegung von Migrations-SQL", () => {
  it("trennt an Semikolons", () => {
    expect(splitStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("lässt sich von einem Semikolon in einer Zeichenkette nicht täuschen", () => {
    const sql = `INSERT INTO t VALUES ('a;b'); SELECT 1;`;
    expect(splitStatements(sql)).toEqual([`INSERT INTO t VALUES ('a;b')`, "SELECT 1"]);
  });

  it("versteht verdoppelte Anführungszeichen innerhalb einer Zeichenkette", () => {
    const sql = `INSERT INTO t VALUES ('Bezi''s Lampe; hell'); SELECT 2;`;
    const teile = splitStatements(sql);
    expect(teile).toHaveLength(2);
    expect(teile[0]).toContain("Bezi''s Lampe; hell");
  });

  it("entfernt Zeilenkommentare, ohne die Anweisung zu zerreißen", () => {
    const sql = "-- CreateTable\nCREATE TABLE a (id TEXT);\n-- Noch was\nSELECT 1;";
    expect(splitStatements(sql)).toEqual(["CREATE TABLE a (id TEXT)", "SELECT 1"]);
  });

  it("ignoriert ein Semikolon in einem Kommentar", () => {
    expect(splitStatements("SELECT 1 -- hier; steht was\n;")).toEqual(["SELECT 1"]);
  });

  it("kommt ohne abschließendes Semikolon aus", () => {
    expect(splitStatements("SELECT 1")).toEqual(["SELECT 1"]);
  });

  it("liefert für leere Eingabe nichts", () => {
    expect(splitStatements("")).toEqual([]);
    expect(splitStatements("\n\n  \n")).toEqual([]);
  });

  it("zerlegt jede echte Migration des Projekts fehlerfrei", () => {
    // Wächst mit: jede neue Migration wird hier automatisch mitgeprüft.
    const ordner = path.join(process.cwd(), "prisma", "migrations");
    const migrationen = fs
      .readdirSync(ordner, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(ordner, e.name, "migration.sql"))
      .filter((f) => fs.existsSync(f));

    expect(migrationen.length).toBeGreaterThan(0);

    for (const datei of migrationen) {
      const teile = splitStatements(fs.readFileSync(datei, "utf8"));
      expect(teile.length, `${path.basename(path.dirname(datei))} ergab keine Anweisungen`).toBeGreaterThan(0);
      for (const teil of teile) {
        expect(teil.includes(";"), `Semikolon in Einzelanweisung: ${teil.slice(0, 60)}`).toBe(false);
        expect(teil.trim()).not.toBe("");
      }
    }
  });
});
