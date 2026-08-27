"use strict";
/**
 * OnTrack Desktop — Electron-Hauptprozess.
 *
 * Die App ist im Kern ein Next.js-Server. Der Desktop-Build startet diesen
 * Server lokal als Kindprozess und zeigt ihn in einem Fenster an. Datenbank
 * und Fotos liegen im Benutzerordner des Betriebssystems und überleben damit
 * jedes Update der App.
 */
const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const { fork } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

app.setName("OnTrack");

const isPackaged = app.isPackaged;
const projectRoot = path.join(__dirname, "..");

// Im gepackten Build liegen Server und Migrationen unter resources/,
// in der Entwicklung direkt im Projekt.
const serverDir = isPackaged
  ? path.join(process.resourcesPath, "app-server")
  : path.join(projectRoot, ".next", "standalone");
const migrationsDir = isPackaged
  ? path.join(process.resourcesPath, "migrations")
  : path.join(projectRoot, "prisma", "migrations");

const dataDir = path.join(app.getPath("userData"), "data");
const dbFile = path.join(dataDir, "db", "ontrack.db");
const settingsFile = path.join(app.getPath("userData"), "desktop-settings.json");

let serverProcess = null;
let mainWindow = null;
let serverUrl = null;
let quitting = false;

// ── Einstellungen ────────────────────────────────────────────────────

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const merged = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Datenbank sichern.
 *
 * `VACUUM INTO` lässt SQLite selbst einen in sich stimmigen Stand
 * herausschreiben, auch während der Server läuft. Eine gewöhnliche Dateikopie
 * kann mitten in einer Schreibaktion entstehen — und das merkt man erst, wenn
 * man die Sicherung braucht.
 *
 * Der Prisma-Client liegt beim Server unter resources/, nicht im asar-Archiv.
 * Lässt er sich hier nicht laden, wird kopiert wie bisher und im Dialog
 * gesagt, dass die App dafür besser beendet wird. Lieber eine Sicherung mit
 * Hinweis als gar keine.
 *
 * @returns "vacuum" oder "kopie" — was tatsächlich gemacht wurde.
 */
async function sichereDatenbank(zielPfad) {
  try {
    const { PrismaClient } = require(path.join(serverDir, "node_modules", "@prisma", "client"));
    const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
    try {
      // VACUUM INTO überschreibt nichts — der Dateidialog fragt aber bereits
      // nach, also ist eine vorhandene Datei hier gewollt.
      fs.rmSync(zielPfad, { force: true });
      await prisma.$executeRawUnsafe(`VACUUM INTO '${zielPfad.replace(/'/g, "''")}'`);
      return "vacuum";
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.warn("[backup] VACUUM INTO nicht möglich, kopiere stattdessen:", error?.message);
    fs.copyFileSync(dbFile, zielPfad);
    return "kopie";
  }
}

/** Standardmäßig hört der Server nur auf diesem Rechner. */
function shareOnNetwork() {
  return readSettings().shareOnNetwork === true;
}

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);
}

// ── Server-Lebenszyklus ──────────────────────────────────────────────

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (quitting) return reject(new Error("Abbruch"));
      if (!serverProcess) return reject(new Error("Serverprozess wurde beendet."));
      if (Date.now() > deadline) {
        return reject(new Error("Der Server hat nicht rechtzeitig geantwortet."));
      }

      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => setTimeout(attempt, 250));
      request.setTimeout(2_000, () => request.destroy());
    };

    attempt();
  });
}

async function startServer() {
  const port = await findFreePort();
  const hostname = shareOnNetwork() ? "0.0.0.0" : "127.0.0.1";

  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    // ELECTRON_RUN_AS_NODE lässt die Electron-Binary als reines Node laufen —
    // auf dem Zielrechner muss also kein Node installiert sein.
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: hostname,
      DATABASE_URL: `file:${dbFile}`,
      ONTRACK_SERVER_DIR: serverDir,
      ONTRACK_MIGRATIONS_DIR: migrationsDir,
      ONTRACK_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout?.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr?.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  let startupError = null;
  serverProcess.on("message", (message) => {
    if (message?.type === "error") startupError = message;
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (quitting) return;
    dialog.showErrorBox(
      "OnTrack wurde beendet",
      startupError
        ? `${startupError.message}\n\n${startupError.detail}`
        : `Der interne Server ist unerwartet beendet worden (Code ${code}).`
    );
    app.quit();
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

function stopServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  serverProcess = null;
  child.removeAllListeners("exit");
  child.kill();
}

async function restartServer() {
  quitting = true;
  stopServer();
  quitting = false;
  const url = await startServer();
  mainWindow?.loadURL(url);
}

// ── Fenster ──────────────────────────────────────────────────────────

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#ffffff",
    title: "OnTrack",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Externe Links im Systembrowser öffnen, nicht im App-Fenster.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(serverUrl)) {
      shell.openExternal(target);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.loadURL(url);
}

/**
 * Die Kamera (QR-Scan) wird nur für die eigene lokale Oberfläche freigegeben —
 * nicht für beliebige Seiten.
 *
 * "geolocation" fehlt hier bewusst: Electron liefert Chromium ohne
 * Google-API-Schlüssel aus, die Standortabfrage läuft daher ins Leere und
 * endet erst nach dem Timeout von 8 Sekunden. Wird die Berechtigung
 * stattdessen abgelehnt, meldet der Browser den Fehler sofort — die App
 * erfasst den Scan dann ohne Koordinaten, aber ohne Wartezeit.
 */
function configurePermissions() {
  const allowed = new Set(["media", "clipboard-sanitized-write"]);
  const handler = (webContents, permission, callback) => {
    const origin = webContents?.getURL() ?? "";
    callback(allowed.has(permission) && serverUrl != null && origin.startsWith(serverUrl));
  };

  session.defaultSession.setPermissionRequestHandler(handler);
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission, origin) =>
      allowed.has(permission) && serverUrl != null && origin.startsWith(serverUrl)
  );
}

// ── Menü ─────────────────────────────────────────────────────────────

function buildMenu() {
  const shared = shareOnNetwork();

  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "Datei",
      submenu: [
        {
          label: "Datenordner öffnen",
          click: () => shell.openPath(dataDir),
        },
        {
          label: "Datenbank sichern …",
          click: async () => {
            const stamp = new Date().toISOString().slice(0, 10);
            const { canceled, filePath } = await dialog.showSaveDialog({
              title: "Datenbank sichern",
              defaultPath: `ontrack-backup-${stamp}.db`,
            });
            if (canceled || !filePath) return;
            try {
              const art = await sichereDatenbank(filePath);
              dialog.showMessageBox({
                type: "info",
                message: "Sicherung erstellt",
                detail:
                  art === "vacuum"
                    ? filePath
                    : `${filePath}\n\nHinweis: Es wurde eine einfache Dateikopie angelegt. ` +
                      `Die App am besten vorher beenden, damit der Stand sicher vollständig ist.`,
              });
            } catch (error) {
              dialog.showErrorBox("Sicherung fehlgeschlagen", String(error));
            }
          },
        },
        { type: "separator" },
        {
          label: "Im Netzwerk freigeben",
          type: "checkbox",
          checked: shared,
          click: async (item) => {
            const enable = item.checked;
            if (enable) {
              const { response } = await dialog.showMessageBox({
                type: "warning",
                buttons: ["Freigeben", "Abbrechen"],
                defaultId: 1,
                cancelId: 1,
                message: "OnTrack im lokalen Netzwerk freigeben?",
                detail:
                  "Danach können Handys und andere Rechner im selben WLAN auf " +
                  "diese OnTrack-Instanz zugreifen (Anmeldung bleibt erforderlich). " +
                  "Hinweis: Kamera-Scan und GPS funktionieren im Browser nur über " +
                  "HTTPS — über die Netzwerkadresse steht daher nur die manuelle " +
                  "Eingabe der Inventarnummer zur Verfügung.",
              });
              if (response !== 0) {
                item.checked = false;
                return;
              }
            }
            writeSettings({ shareOnNetwork: enable });
            await restartServer();
            buildMenu();
            if (enable) {
              const addresses = localAddresses();
              dialog.showMessageBox({
                type: "info",
                message: "OnTrack ist im Netzwerk erreichbar",
                detail:
                  addresses.length > 0
                    ? addresses
                        .map((ip) => `http://${ip}:${new URL(serverUrl).port}`)
                        .join("\n")
                    : "Keine Netzwerkadresse gefunden.",
              });
            }
          },
        },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "Ansicht",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Projektseite öffnen",
          click: () => shell.openExternal("https://github.com/thecrafti87/ontrack"),
        },
        {
          label: "Über OnTrack",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              message: `OnTrack ${app.getVersion()}`,
              detail:
                `Inventar- und Einsatz-Tracking für Veranstaltungstechnik.\n\n` +
                `Daten: ${dataDir}\nElectron ${process.versions.electron} · ` +
                `Node ${process.versions.node} · Chromium ${process.versions.chrome}`,
            }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Start ────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      const url = await startServer();
      configurePermissions();
      buildMenu();
      createWindow(url);
    } catch (error) {
      dialog.showErrorBox("OnTrack konnte nicht starten", String(error?.stack || error));
      app.quit();
      return;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && serverUrl) createWindow(serverUrl);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });
}
