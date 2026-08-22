"use strict";
/**
 * Legt die Server-Nutzlast neben die App und signiert macOS-Builds ad hoc.
 *
 * Die Nutzlast wird bewusst hier kopiert statt über `extraResources`:
 * electron-builder filtert dort ein Verzeichnis namens `node_modules` heraus,
 * womit der Standalone-Server ohne Prisma-Client und ohne seine
 * Laufzeitabhängigkeiten im Paket landet und die App beim Start abstürzt.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const PAYLOAD = [
  [path.join("..", ".next", "standalone"), "app-server"],
  [path.join("..", "prisma", "migrations"), "migrations"],
];

function resourcesDir(context) {
  if (context.electronPlatformName === "darwin") {
    return path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      "Contents",
      "Resources"
    );
  }
  return path.join(context.appOutDir, "resources");
}

exports.default = async function afterPack(context) {
  const projectRoot = path.join(__dirname, "..");
  const resources = resourcesDir(context);

  for (const [from, to] of PAYLOAD) {
    const source = path.resolve(__dirname, from);
    const target = path.join(resources, to);
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(source, target, { recursive: true });
    console.log(`  • kopiert: ${path.relative(projectRoot, source)} → resources/${to}`);
  }

  // Ohne Apple-Developer-Zertifikat wird nicht notarisiert. Eine
  // Ad-hoc-Signatur ist trotzdem nötig: auf Apple Silicon startet eine völlig
  // unsignierte App gar nicht. Sie muss nach dem Kopieren gesetzt werden,
  // damit sie den endgültigen Paketinhalt abdeckt.
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
      stdio: "inherit",
    });
    console.log(`  • Ad-hoc-Signatur gesetzt: ${path.relative(projectRoot, appPath)}`);
  } catch (error) {
    console.warn(`  • Ad-hoc-Signatur fehlgeschlagen: ${error.message}`);
  }
};
