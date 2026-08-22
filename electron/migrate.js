"use strict";
/**
 * Wendet ausstehende Prisma-Migrationen auf die SQLite-Datei an.
 *
 * Der Desktop-Build kann die Prisma-CLI (`prisma migrate deploy`) nicht
 * mitliefern — die bräuchte zusätzlich die Schema-Engine (~40 MB) und ein
 * vollständiges node_modules. Stattdessen führen wir die von Prisma
 * erzeugten migration.sql-Dateien direkt über den Query-Engine-Kanal aus und
 * schreiben dieselbe Buchführung in `_prisma_migrations`, die auch die CLI
 * anlegt. Dadurch bleibt die Datenbank für `prisma migrate` kompatibel.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * Zerlegt eine Migrationsdatei in einzelne Statements. Die Query-Engine führt
 * pro Aufruf genau ein Statement aus, ein simples split(";") würde aber an
 * Semikolons innerhalb von String-Literalen zerbrechen.
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        current += ch;
      }
      continue;
    }

    if (!inString && ch === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      // '' innerhalb eines Strings ist ein escaptes Anführungszeichen
      if (inString && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
      current += ch;
      continue;
    }

    if (ch === ";" && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const rest = current.trim();
  if (rest) statements.push(rest);
  return statements;
}

/** Prisma bildet die Prüfsumme als SHA-256 über den Dateiinhalt. */
function checksum(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function applyMigrations(prisma, migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrationsordner nicht gefunden: ${migrationsDir}`);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const applied = await prisma.$queryRawUnsafe(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`
  );
  const done = new Set(applied.map((row) => row.migration_name));

  const pending = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .filter((name) => !done.has(name));

  if (pending.length === 0) return [];

  for (const name of pending) {
    const file = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(file)) continue;

    const sql = fs.readFileSync(file, "utf8");
    const statements = splitStatements(sql);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations"
         ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
       VALUES (?, ?, current_timestamp, ?, current_timestamp, ?)`,
      crypto.randomUUID(),
      checksum(sql),
      name,
      statements.length
    );
  }

  return pending;
}

module.exports = { applyMigrations, splitStatements };
