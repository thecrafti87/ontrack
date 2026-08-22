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
möchtest. Für eine vollständige Sicherung zusätzlich den Ordner `uploads/`
kopieren.

Es gibt keine automatische Sicherung. Bei ernsthafter Nutzung: regelmäßig
sichern.

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
