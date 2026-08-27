#!/usr/bin/env node
/**
 * Sicherung der OnTrack-Datenbank im laufenden Betrieb.
 *
 * Warum nicht einfach `cp`? Die Datenbank ist zwar eine Datei, aber eine, in
 * die gerade geschrieben werden kann. Eine Kopie mitten in einer Transaktion
 * ist im besten Fall veraltet und im schlechtesten unbrauchbar — und man
 * merkt es erst, wenn man sie braucht. `VACUUM INTO` lässt SQLite selbst
 * einen in sich stimmigen Stand herausschreiben, ohne den Betrieb anzuhalten.
 * Nebenbei ist das Ergebnis kompakter als das Original.
 *
 * Die Fotos daneben sind unveränderlich: Ein Upload bekommt einen zufälligen
 * Namen und wird nie überschrieben. Deshalb genügt es, neu hinzugekommene
 * Dateien zu übertragen, statt jedes Mal alles zu kopieren.
 *
 * Aufruf:
 *   node scripts/backup.mjs [--ziel <ordner>] [--behalten <anzahl>] [--ohne-uploads]
 *
 * Umgebungsvariablen (die Schalter haben Vorrang):
 *   DATABASE_URL         file:/pfad/zur/ontrack.db
 *   ONTRACK_DATA_DIR     Datenverzeichnis, darunter liegt uploads/
 *   ONTRACK_BACKUP_DIR   Zielordner (Standard: <Datenverzeichnis>/backups)
 *   ONTRACK_BACKUP_KEEP  Wie viele Stände aufgehoben werden (Standard: 14)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const DATEI_MUSTER = /^ontrack-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-\d+)?\.db$/;

export function leseArgumente(argv) {
  const args = { ziel: null, behalten: null, uploads: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ziel") args.ziel = argv[++i];
    else if (arg === "--behalten") args.behalten = argv[++i];
    else if (arg === "--ohne-uploads") args.uploads = false;
    else if (arg === "--hilfe" || arg === "-h") {
      console.log(
        "Aufruf: node scripts/backup.mjs [--ziel <ordner>] [--behalten <anzahl>] [--ohne-uploads]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unbekannter Schalter: ${arg}`);
    }
  }

  return args;
}

/** Aus DATABASE_URL den Dateipfad herausholen. Nur SQLite ergibt hier Sinn. */
function datenbankPfad() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  if (!url.startsWith("file:")) {
    throw new Error(
      `Dieses Skript sichert SQLite-Datenbanken. DATABASE_URL zeigt auf: ${url.split(":")[0]}:…`
    );
  }
  return path.resolve(url.slice("file:".length));
}

function behaltenAnzahl(schalter) {
  const roh = schalter ?? process.env.ONTRACK_BACKUP_KEEP ?? "14";
  const zahl = Number.parseInt(roh, 10);
  if (!Number.isFinite(zahl) || zahl < 1) {
    throw new Error(`--behalten braucht eine Zahl ab 1, bekommen: ${roh}`);
  }
  return zahl;
}

export function zeitstempel(jetzt) {
  // Sortierbar als Dateiname: Die lexikografische Reihenfolge ist zugleich
  // die zeitliche, damit das Aufräumen ohne Dateisystem-Zeitstempel auskommt.
  return jetzt.toISOString().slice(0, 19).replace(/[:]/g, "-");
}

/**
 * Ältere Stände entfernen, bis nur noch `behalten` übrig sind.
 * Fremde Dateien im Ordner bleiben unangetastet.
 */
export function raeumeAuf(zielOrdner, behalten) {
  const staende = fs
    .readdirSync(zielOrdner)
    .filter((name) => DATEI_MUSTER.test(name))
    .sort();

  const zuLoeschen = staende.slice(0, Math.max(0, staende.length - behalten));
  for (const name of zuLoeschen) {
    fs.rmSync(path.join(zielOrdner, name), { force: true });
  }
  return zuLoeschen.length;
}

/**
 * Neue Uploads übertragen. Vergleicht nur die Existenz, nicht den Inhalt —
 * die Dateinamen sind zufällig vergeben und werden nie wiederverwendet.
 */
export function sichereUploads(quelle, ziel) {
  if (!fs.existsSync(quelle)) return { kopiert: 0, uebersprungen: 0 };

  fs.mkdirSync(ziel, { recursive: true });
  let kopiert = 0;
  let uebersprungen = 0;

  for (const eintrag of fs.readdirSync(quelle, { withFileTypes: true })) {
    if (!eintrag.isFile()) continue;
    const zielDatei = path.join(ziel, eintrag.name);
    if (fs.existsSync(zielDatei)) {
      uebersprungen++;
      continue;
    }
    fs.copyFileSync(path.join(quelle, eintrag.name), zielDatei);
    kopiert++;
  }

  return { kopiert, uebersprungen };
}

/** Erster freier Dateiname für diesen Zeitstempel. */
export function freierName(zielOrdner, stempel) {
  const erster = path.join(zielOrdner, `ontrack-${stempel}.db`);
  if (!fs.existsSync(erster)) return erster;

  for (let n = 2; n < 100; n++) {
    const kandidat = path.join(zielOrdner, `ontrack-${stempel}-${n}.db`);
    if (!fs.existsSync(kandidat)) return kandidat;
  }
  throw new Error(`Zu viele Sicherungen in derselben Sekunde: ${stempel}`);
}

function megabyte(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const args = leseArgumente(process.argv.slice(2));

  const dbDatei = datenbankPfad();
  if (!fs.existsSync(dbDatei)) {
    throw new Error(`Datenbank nicht gefunden: ${dbDatei}`);
  }

  const datenVerzeichnis = process.env.ONTRACK_DATA_DIR ?? path.join(process.cwd(), "data");
  const zielOrdner = path.resolve(
    args.ziel ?? process.env.ONTRACK_BACKUP_DIR ?? path.join(datenVerzeichnis, "backups")
  );
  const behalten = behaltenAnzahl(args.behalten);

  fs.mkdirSync(zielOrdner, { recursive: true });

  // VACUUM INTO weigert sich, eine vorhandene Datei zu überschreiben. Zwei
  // Läufe in derselben Sekunde sind kein Grund für einen Fehlschlag — im
  // Zeitplan würde das nur eine Fehlermeldung erzeugen, die nichts bedeutet.
  const zielDatei = freierName(zielOrdner, zeitstempel(new Date()));

  const prisma = new PrismaClient();
  try {
    // VACUUM INTO nimmt keine Platzhalter für den Dateinamen — der Pfad muss
    // in die Anweisung. Einfache Anführungszeichen deshalb verdoppeln.
    const escaped = zielDatei.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  } finally {
    await prisma.$disconnect();
  }

  const groesse = fs.statSync(zielDatei).size;
  console.log(`Datenbank gesichert: ${zielDatei} (${megabyte(groesse)})`);

  if (args.uploads) {
    const { kopiert, uebersprungen } = sichereUploads(
      path.join(datenVerzeichnis, "uploads"),
      path.join(zielOrdner, "uploads")
    );
    console.log(`Uploads: ${kopiert} neu übertragen, ${uebersprungen} bereits vorhanden`);
  }

  const geloescht = raeumeAuf(zielOrdner, behalten);
  if (geloescht > 0) {
    console.log(`${geloescht} ältere(r) Stand/Stände entfernt (behalten: ${behalten})`);
  }
}

// Nur ausführen, wenn direkt aufgerufen — beim Import aus einem Test soll
// nichts gesichert werden. fileURLToPath statt eigener Pfad-Bastelei, sonst
// stimmt der Vergleich unter Windows nicht.
const direktAufgerufen =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (direktAufgerufen) {
  main().catch((fehler) => {
    console.error(`Sicherung fehlgeschlagen: ${fehler.message}`);
    process.exit(1);
  });
}
