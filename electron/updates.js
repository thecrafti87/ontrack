"use strict";

/**
 * Selbstupdate der Desktop-App.
 *
 * Zwei Wege, weil zwei Wirklichkeiten:
 *
 * - **Windows und Linux** können sich selbst ersetzen. Dafür sorgt
 *   `electron-updater`: Es liest den Feed (`latest.yml` bzw.
 *   `latest-linux.yml`) aus dem GitHub-Release, lädt den Installer und
 *   tauscht die Anwendung beim nächsten Beenden aus.
 *
 * - **macOS nicht.** Squirrel.Mac prüft vor dem Austausch die Code-Signatur,
 *   und OnTrack ist nicht bei Apple notarisiert — dafür bräuchte es ein
 *   kostenpflichtiges Developer-Programm. Ein Selbstupdate würde dort nicht
 *   scheitern, sondern *stillschweigend* nichts tun, was schlimmer ist.
 *   Deshalb wird auf dem Mac nur gemeldet, dass es etwas Neues gibt, und die
 *   Release-Seite geöffnet.
 *
 * Es gibt keine Benachrichtigung „in dem Moment, in dem veröffentlicht wird" —
 * dafür bräuchte es einen dauerhaft offenen Kanal zu jedem Gerät. Statt dessen
 * fragt die App nach dem Start und danach alle sechs Stunden nach. Eine neue
 * Fassung fällt damit innerhalb eines Arbeitstages auf, nicht in derselben
 * Sekunde.
 */

const { app, dialog, shell } = require("electron");

/**
 * Das Repository, aus dem sich die App versorgt.
 *
 * Bewusst hier eingetragen und NICHT zur Laufzeit aus der package.json
 * gelesen: electron-builder streift beim Packen `build`, `scripts` und
 * `devDependencies` heraus, und ein Selbstupdate, das sich auf ein
 * weggestrichenes Feld verlässt, ist in jedem gebauten Paket blind — im
 * Quelltext aber nicht nachweisbar. `tests/packaging.test.ts` hält diesen
 * Wert mit `package.json` und `electron-builder.yml` zusammen.
 */
const REPO = { owner: "thecrafti87", repo: "ontrack" };

/** Abstand zwischen zwei automatischen Nachfragen. */
const NACHFRAGE_ABSTAND_MS = 6 * 60 * 60 * 1000;

/** Vorlauf nach dem Start — erst arbeiten lassen, dann nachfragen. */
const NACHFRAGE_VORLAUF_MS = 15 * 1000;

/** Kann sich die Anwendung auf diesem System selbst ersetzen? */
const KANN_SELBST_INSTALLIEREN = process.platform !== "darwin";

let laeuft = false;
let intervall = null;

/**
 * Versionsvergleich für den Mac-Weg.
 *
 * Nur so viel Semver, wie hier gebraucht wird: drei Zahlen, das übliche „v"
 * davor darf fehlen. Ein Vorabkennzeichen („1.2.0-beta") gilt als älter als
 * die fertige Fassung — sonst würde eine Testfassung dauerhaft als Update
 * angeboten.
 */
function istNeuer(kandidat, aktuell) {
  const zerlege = (v) => {
    const [kern, vorab] = String(v).replace(/^v/, "").split("-");
    const teile = kern.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return { teile, vorab: vorab ?? null };
  };

  const a = zerlege(kandidat);
  const b = zerlege(aktuell);

  for (let i = 0; i < 3; i++) {
    const links = a.teile[i] ?? 0;
    const rechts = b.teile[i] ?? 0;
    if (links !== rechts) return links > rechts;
  }

  // Gleicher Kern: fertig schlägt Vorab.
  if (a.vorab && !b.vorab) return false;
  if (!a.vorab && b.vorab) return true;
  return false;
}

/** Neueste veröffentlichte Fassung laut GitHub. */
async function neuesteFassung() {
  const antwort = await fetch(
    `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/releases/latest`,
    {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "OnTrack" },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!antwort.ok) {
    throw new Error(`GitHub antwortete mit ${antwort.status}`);
  }

  const release = await antwort.json();
  return {
    version: String(release.tag_name ?? "").replace(/^v/, ""),
    seite: release.html_url,
  };
}

/** Der Mac-Weg: melden und die Release-Seite anbieten. */
async function pruefeMac(still) {
  const { version, seite } = await neuesteFassung();

  if (!version || !istNeuer(version, app.getVersion())) {
    if (!still) {
      await dialog.showMessageBox({
        type: "info",
        message: "OnTrack ist aktuell",
        detail: `Installiert ist Fassung ${app.getVersion()}.`,
      });
    }
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    message: `OnTrack ${version} ist verfügbar`,
    detail:
      `Installiert ist ${app.getVersion()}.\n\n` +
      `Auf dem Mac kann sich OnTrack nicht selbst ersetzen — die App ist ` +
      `nicht bei Apple notarisiert. Lade die neue Fassung herunter und ziehe ` +
      `sie über die alte in den Ordner „Programme“. Deine Daten bleiben dabei ` +
      `erhalten.`,
    buttons: ["Download-Seite öffnen", "Später"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) await shell.openExternal(seite);
}

/** Windows und Linux: electron-updater lädt und tauscht aus. */
async function pruefeMitUpdater(still) {
  const { autoUpdater } = require("electron-updater");

  // Nichts hinter dem Rücken des Benutzers: Erst fragen, dann laden.
  autoUpdater.autoDownload = false;
  // Ist etwas geladen und die App wird beendet, wird es eingespielt — auch
  // wenn niemand auf „Jetzt neu starten" geklickt hat.
  autoUpdater.autoInstallOnAppQuit = true;

  const ergebnis = await autoUpdater.checkForUpdates();
  const gefunden = ergebnis?.updateInfo?.version;

  if (!gefunden || !istNeuer(gefunden, app.getVersion())) {
    if (!still) {
      await dialog.showMessageBox({
        type: "info",
        message: "OnTrack ist aktuell",
        detail: `Installiert ist Fassung ${app.getVersion()}.`,
      });
    }
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    message: `OnTrack ${gefunden} ist verfügbar`,
    detail:
      `Installiert ist ${app.getVersion()}.\n\n` +
      `Das Update wird im Hintergrund geladen. Deine Daten bleiben erhalten.`,
    buttons: ["Jetzt laden", "Später"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response !== 0) return;

  await autoUpdater.downloadUpdate();

  const { response: danach } = await dialog.showMessageBox({
    type: "info",
    message: `OnTrack ${gefunden} ist bereit`,
    detail:
      "Zum Abschließen wird OnTrack neu gestartet. Wenn gerade jemand mit " +
      "der App arbeitet, lässt sich das auch auf später verschieben — dann " +
      "wird beim nächsten Beenden eingespielt.",
    buttons: ["Jetzt neu starten", "Beim Beenden"],
    defaultId: 0,
    cancelId: 1,
  });

  if (danach === 0) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
}

/**
 * Nach einer neueren Fassung sehen.
 *
 * @param {object} [optionen]
 * @param {boolean} [optionen.still] Bei `true` bleiben Fehler und „schon
 *   aktuell" unsichtbar. So läuft die Nachfrage beim Start: Wer OnTrack im
 *   Lager ohne Netz startet, soll keine Fehlermeldung sehen.
 */
async function pruefeAufUpdate(optionen = {}) {
  const still = optionen.still === true;

  // Im Quelltextbetrieb gibt es nichts zu ersetzen.
  if (!app.isPackaged) {
    if (!still) {
      await dialog.showMessageBox({
        type: "info",
        message: "Nicht in der Entwicklungsfassung",
        detail: "Die Update-Prüfung läuft nur in der installierten App.",
      });
    }
    return;
  }

  // Zwei Prüfungen gleichzeitig ergeben zwei Dialoge übereinander.
  if (laeuft) return;
  laeuft = true;

  try {
    if (KANN_SELBST_INSTALLIEREN) await pruefeMitUpdater(still);
    else await pruefeMac(still);
  } catch (fehler) {
    console.warn("[updates] Prüfung fehlgeschlagen:", fehler?.message ?? fehler);
    if (!still) {
      dialog.showErrorBox(
        "Update-Prüfung fehlgeschlagen",
        `${fehler?.message ?? fehler}\n\nBesteht eine Internetverbindung?`
      );
    }
  } finally {
    laeuft = false;
  }
}

/**
 * Automatische Nachfrage einrichten: einmal kurz nach dem Start, danach
 * regelmäßig. Beides still — ungefragt soll nur auffallen, was es zu tun
 * gibt, nicht dass gerade nichts zu tun ist.
 */
function starteAutomatischePruefung() {
  if (!app.isPackaged) return;

  setTimeout(() => pruefeAufUpdate({ still: true }), NACHFRAGE_VORLAUF_MS);

  intervall = setInterval(() => pruefeAufUpdate({ still: true }), NACHFRAGE_ABSTAND_MS);
  // Hindert das Beenden nicht.
  if (typeof intervall.unref === "function") intervall.unref();
}

function stoppeAutomatischePruefung() {
  if (intervall) clearInterval(intervall);
  intervall = null;
}

module.exports = {
  REPO,
  istNeuer,
  pruefeAufUpdate,
  starteAutomatischePruefung,
  stoppeAutomatischePruefung,
  KANN_SELBST_INSTALLIEREN,
};
