/**
 * Ergänzt den Standalone-Output um die Dateien, die Next.js bewusst nicht
 * hineinkopiert (public/ und .next/static/ gehören im Webbetrieb auf ein CDN)
 * und entfernt, was dort nicht hingehört.
 *
 * Wird sowohl vom Desktop-Build als auch vom Docker-Image benutzt.
 */
import { cp, rm, access, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error(
    "Kein Standalone-Output gefunden. Zuerst `npm run build` ausführen " +
      '(next.config.ts muss output: "standalone" gesetzt haben).'
  );
  process.exit(1);
}

for (const [from, to] of [
  [path.join(root, "public"), path.join(standalone, "public")],
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
]) {
  if (!(await exists(from))) continue;
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log(`kopiert: ${path.relative(root, from)} → ${path.relative(root, to)}`);
}

// Muss vorhanden sein, sonst startet Prisma im gepackten Build nicht.
const engineDir = path.join(standalone, "node_modules", ".prisma", "client");
if (!(await exists(engineDir))) {
  console.error(
    `Prisma-Client fehlt im Standalone-Output (${path.relative(root, engineDir)}).\n` +
      "Vor dem Build `npx prisma generate` ausführen."
  );
  process.exit(1);
}
console.log("Prisma-Client im Standalone-Output vorhanden.");

// ── Schutz vor versehentlich mitgepackten Laufzeitdaten ───────────────
//
// Das Datei-Tracing folgt dem Datenbankpfad und hat schon einmal die lokale
// Entwicklungsdatenbank samt Uploads in den Output gezogen. In einem
// öffentlichen Release wäre das ein Datenleck, deshalb hier eine harte
// Schranke statt eines stillen Aufräumens.

// Next.js legt eine Kopie der .env-Dateien neben den Standalone-Server. Die
// Pfade darin gelten für die Entwicklung, und in ein Release gehören sie
// ohnehin nicht.
for (const entry of await readdir(standalone, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.startsWith(".env")) {
    await rm(path.join(standalone, entry.name));
    console.log(`entfernt: ${path.join(".next/standalone", entry.name)}`);
  }
}

// Ebenso das Datenverzeichnis, falls das Tracing es doch wieder einsammelt.
await rm(path.join(standalone, "data"), { recursive: true, force: true });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const forbidden = /\.(db|db-journal|db-wal|db-shm|sqlite|sqlite3|env)$/i;
const leaked = [];
for await (const file of walk(standalone)) {
  if (forbidden.test(file)) leaked.push(path.relative(root, file));
}

if (leaked.length > 0) {
  console.error(
    "Abbruch: Laufzeitdaten im Standalone-Output gefunden — die dürfen nicht " +
      "ausgeliefert werden:\n" +
      leaked.map((f) => `  ${f}`).join("\n")
  );
  process.exit(1);
}
console.log("Keine Datenbank-, Upload- oder .env-Dateien im Output.");
