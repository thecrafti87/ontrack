# OnTrack als Desktop-App

Die Desktop-Version bringt alles mit, was OnTrack braucht — Server, Datenbank
und Oberfläche. Es muss nichts installiert werden außer der App selbst: weder
Node.js noch Docker.

**Wichtig zum Verständnis:** Die App läuft auf **einem** Rechner und speichert
ihre Daten dort. Sie synchronisiert sich nicht mit anderen Installationen. Wer
mit mehreren Personen gleichzeitig auf denselben Bestand zugreifen will,
betreibt OnTrack besser als Server — siehe [README.md](README.md).

## Herunterladen

Alle Dateien liegen unter **[Releases](https://github.com/thecrafti87/ontrack/releases)**.

| System | Datei | Hinweis |
| --- | --- | --- |
| macOS (Apple Silicon, M1–M4) | `OnTrack-<Version>-arm64.dmg` | Standard für alle Macs ab 2020 |
| macOS (Intel) | `OnTrack-<Version>.dmg` | für ältere Macs |
| Windows 10/11 (64-Bit) | `OnTrack-Setup-<Version>.exe` | |
| Linux (universell) | `OnTrack-<Version>.AppImage` | läuft ohne Installation |
| Debian / Ubuntu / Mint | `ontrack_<Version>_amd64.deb` | |

Welchen Mac du hast, steht im Apple-Menü unter „Über diesen Mac": Ein
Eintrag wie „Apple M1"/„M2"/„M3" bedeutet Apple Silicon, „Intel" den
anderen Download.

## Installieren

### macOS

1. DMG öffnen, OnTrack in den Ordner **Programme** ziehen.
2. **Beim ersten Start:** Rechtsklick auf OnTrack → **Öffnen** → im Dialog
   nochmals **Öffnen**. Ein Doppelklick genügt beim ersten Mal *nicht*.

Der Umweg ist nötig, weil die App nicht bei Apple notarisiert ist — dafür
bräuchte es ein kostenpflichtiges Developer-Programm. macOS zeigt sonst
„OnTrack kann nicht geöffnet werden, da der Entwickler nicht verifiziert
werden kann". Meldet macOS stattdessen, die App sei **beschädigt**, hat sie
die Quarantäne-Markierung aus dem Download behalten; dann einmalig im
Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/OnTrack.app
```

### Windows

Setup starten. Windows SmartScreen meldet „Der Computer wurde durch Windows
geschützt" — auf **Weitere Informationen** und dann **Trotzdem ausführen**
klicken. Auch hier fehlt lediglich eine kostenpflichtige Code-Signatur.

Die Installation läuft ohne Administratorrechte in dein Benutzerprofil.

### Linux

**AppImage** (funktioniert auf jeder Distribution):

```bash
chmod +x OnTrack-*.AppImage
./OnTrack-*.AppImage
```

**Debian/Ubuntu:**

```bash
sudo apt install ./ontrack_*_amd64.deb
```

## Erster Start

Beim ersten Start legt OnTrack eine leere Datenbank an und zeigt die
Registrierung. **Der zuerst registrierte Benutzer wird automatisch Admin**
und ist sofort freigeschaltet. Alle weiteren Registrierungen müssen unter
**Benutzer** freigegeben werden.

Danach unter **Einstellungen → App-Adresse für QR-Codes** die Adresse
eintragen, *bevor* Etiketten gedruckt werden — sonst zeigen die QR-Codes ins
Leere.

## Updates

**Windows und Linux aktualisieren sich selbst.** OnTrack sieht kurz nach dem
Start und danach alle sechs Stunden nach, ob es eine neuere Fassung gibt.
Wenn ja, kommt ein Hinweis mit der Frage, ob geladen werden soll — geladen
und eingespielt wird nur nach Bestätigung. Anschließend lässt sich wählen:
sofort neu starten oder beim nächsten Beenden einspielen. Deine Daten bleiben
dabei erhalten.

**Auf dem Mac meldet OnTrack nur, dass es etwas Neues gibt**, und öffnet auf
Wunsch die Download-Seite. Selbst ersetzen kann sich die App dort nicht: macOS
prüft dafür die Code-Signatur, und OnTrack ist nicht bei Apple notarisiert.
Ein Selbstupdate würde dort nicht mit einer Fehlermeldung scheitern, sondern
stillschweigend nichts tun — das wäre schlimmer als ein ehrlicher Hinweis. Die
neue Fassung also herunterladen und über die alte in den Ordner **Programme**
ziehen; der Datenordner bleibt unangetastet.

Von Hand nachsehen: **Hilfe → Nach Updates suchen …**

Zwei Dinge, die man wissen sollte:

- Es gibt keine Meldung in dem Moment, in dem eine Version veröffentlicht
  wird. Dafür bräuchte es einen dauerhaft offenen Kanal zu jedem Gerät.
  OnTrack fragt statt dessen regelmäßig nach — eine neue Fassung fällt damit
  innerhalb eines Arbeitstages auf, nicht in derselben Sekunde.
- Ohne Internetverbindung passiert schlicht nichts. Die Prüfung beim Start
  ist stumm: Wer OnTrack im Lager ohne Netz startet, bekommt keine
  Fehlermeldung zu sehen.

**Ab welcher Fassung das gilt:** Das Selbstupdate steckt in der App und wirkt
deshalb erst ab der Fassung, die es mitbringt — 1.2.0. Wer 1.0.0 oder 1.1.0
installiert hat, lädt 1.2.0 einmalig von Hand herunter. Danach meldet sich
OnTrack von allein.

## Wo die Daten liegen

Über **Datei → Datenordner öffnen** kommst du direkt hin. Die Pfade:

| System | Ordner |
| --- | --- |
| macOS | `~/Library/Application Support/OnTrack/data` |
| Windows | `%APPDATA%\OnTrack\data` |
| Linux | `~/.config/OnTrack/data` |

Darin: `db/ontrack.db` (die komplette Datenbank, eine einzige Datei) und
`uploads/` (die Fotos).

**Ein Update überschreibt diese Daten nicht.** Neue Version einfach über die
alte installieren; nötige Datenbank-Anpassungen laufen beim Start automatisch.

## Sicherung

**Datei → Datenbank sichern …** legt eine Kopie der Datenbank ab, wo du
möchtest. Das geschieht im laufenden Betrieb und ergibt trotzdem einen in sich
stimmigen Stand. Für eine vollständige Sicherung zusätzlich den Ordner
`uploads/` kopieren.

Zurückspielen: App beenden, die gesicherte Datei über
`…/OnTrack/data/db/ontrack.db` kopieren, App starten. Nötige
Datenbank-Anpassungen laufen dabei automatisch, ein älterer Stand wird also
mitgezogen.

**Es gibt keine automatische Sicherung** — anders als im Server-Betrieb, wo
täglich von allein gesichert wird (siehe [README.md](README.md)). Bei
ernsthafter Nutzung auf dem Desktop: regelmäßig selbst sichern.

## Für andere Geräte freigeben

**Datei → Im Netzwerk freigeben** macht die laufende OnTrack-Instanz für
Handys und andere Rechner im selben WLAN erreichbar; die Adresse wird nach dem
Einschalten angezeigt. Eine Anmeldung ist weiterhin nötig.

Zwei Einschränkungen: Der Rechner mit OnTrack muss laufen, und über die
Netzwerkadresse gibt es kein HTTPS — **Kamera-Scan und GPS funktionieren dort
also nicht**, nur die manuelle Eingabe der Inventarnummer. Wer den
Handy-Scan im Alltag braucht, betreibt OnTrack als Server mit HTTPS.

## Was in der Desktop-Version anders ist

| | Desktop-App | Server (Docker) |
| --- | --- | --- |
| QR-Scan mit der Kamera | ✅ im App-Fenster | ✅ überall, mit HTTPS |
| Standort beim Scan (GPS) | ❌ siehe unten | ✅ |
| Zugriff von Handys | nur über Netzwerkfreigabe, ohne Kamera | ✅ vollständig |
| Mehrere Standorte / Teams | ❌ Daten bleiben lokal | ✅ |
| Einrichtung | Installer doppelklicken | Docker + Reverse-Proxy |

**Zum GPS:** Electron liefert Chromium ohne Google-Standortdienst-Schlüssel
aus, deshalb kann die Desktop-App keine Position ermitteln. Scans werden
weiterhin normal erfasst — nur ohne Koordinaten. Der Fundmodus bleibt nutzbar,
zeigt für solche Scans aber keinen Fundort.

## Deinstallieren

- **macOS:** OnTrack aus dem Ordner Programme in den Papierkorb.
- **Windows:** Einstellungen → Apps → OnTrack → Deinstallieren.
- **Linux:** AppImage löschen bzw. `sudo apt remove ontrack`.

Der Datenordner bleibt dabei erhalten und muss bei Bedarf von Hand gelöscht
werden.

## Selbst bauen

```bash
npm ci
npm run desktop:dev     # startet die Desktop-App aus dem Quellcode
npm run desktop:dist    # baut Installer für das eigene System
```

Installer für alle drei Systeme entstehen über GitHub Actions
([.github/workflows/release.yml](.github/workflows/release.yml)) — jede
Plattform baut auf ihrem eigenen Runner, weil die native Prisma-Engine nicht
cross-kompiliert werden kann.
