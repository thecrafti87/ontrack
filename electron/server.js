"use strict";
/**
 * Wird von main.js als eigenständiger Node-Prozess gestartet
 * (ELECTRON_RUN_AS_NODE=1 — Electron bringt seine Node-Laufzeit selbst mit,
 * auf dem Zielrechner muss kein Node installiert sein).
 *
 * Reihenfolge: Datenverzeichnisse anlegen → Migrationen anwenden →
 * den von Next.js erzeugten Standalone-Server starten.
 */
const fs = require("node:fs");
const path = require("node:path");
const { applyMigrations } = require("./migrate.js");

const serverDir = process.env.ONTRACK_SERVER_DIR;
const migrationsDir = process.env.ONTRACK_MIGRATIONS_DIR;
const dataDir = process.env.ONTRACK_DATA_DIR;

function fail(message, error) {
  process.send?.({ type: "error", message, detail: String(error?.stack || error || "") });
  console.error(message, error);
  process.exit(1);
}

async function main() {
  for (const dir of [dataDir, path.join(dataDir, "db"), path.join(dataDir, "uploads")]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Der Standalone-Server erwartet sein eigenes Verzeichnis als cwd.
  process.chdir(serverDir);

  const clientPath = path.join(serverDir, "node_modules", "@prisma", "client");
  const { PrismaClient } = require(clientPath);
  const prisma = new PrismaClient();

  try {
    const applied = await applyMigrations(prisma, migrationsDir);
    if (applied.length > 0) {
      console.log(`[ontrack] Migrationen angewendet: ${applied.join(", ")}`);
    }
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    fail("Datenbank konnte nicht eingerichtet werden.", error);
    return;
  }

  await prisma.$disconnect().catch(() => {});

  // Ab hier übernimmt der Next.js-Standalone-Server; er liest PORT und
  // HOSTNAME aus der Umgebung, die main.js gesetzt hat.
  require(path.join(serverDir, "server.js"));
}

main().catch((error) => fail("Server konnte nicht gestartet werden.", error));
