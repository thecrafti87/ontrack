OnTrack **1.2.0** — ab dieser Fassung meldet sich die App selbst, wenn es eine
neuere gibt.

## Herunterladen

| System | Datei |
| --- | --- |
| macOS (Apple Silicon) | `OnTrack-1.2.0-arm64.dmg` |
| macOS (Intel) | `OnTrack-1.2.0.dmg` |
| Windows 10/11 | `OnTrack.Setup.1.2.0.exe` |
| Linux (universell) | `OnTrack-1.2.0.AppImage` |
| Debian / Ubuntu | `ontrack_1.2.0_amd64.deb` |

Die beiden `*-mac.zip` sind dieselben App-Bundles ohne DMG-Hülle. Die Dateien
`latest*.yml` sind der Update-Feed — die braucht nur die App, nicht du.

Die Installer sind **nicht signiert**. macOS: beim ersten Start Rechtsklick →
Öffnen. Windows: SmartScreen → Weitere Informationen → Trotzdem ausführen.
Beides ist in [DESKTOP.md](DESKTOP.md) erklärt, ebenso die Prüfsummen in
`SHA256SUMS.txt`.

## Updates, die sich von selbst melden

Bisher musste man wissen, dass es eine neue Fassung gibt, und sie von Hand
holen. Ab 1.2.0 sieht OnTrack kurz nach dem Start und danach alle sechs Stunden
nach.

**Windows und Linux aktualisieren sich selbst.** Gibt es etwas Neues, fragt die
App, ob geladen werden soll — geladen und eingespielt wird nur nach
Bestätigung. Danach die Wahl: sofort neu starten oder beim nächsten Beenden
einspielen. Die Daten bleiben erhalten.

**Auf dem Mac meldet OnTrack nur** und öffnet auf Wunsch die Download-Seite.
Selbst ersetzen darf sich die App dort nicht: macOS prüft dafür die
Code-Signatur, und OnTrack ist nicht bei Apple notarisiert. Ein Selbstupdate
würde dort nicht mit einer Fehlermeldung scheitern, sondern *stillschweigend
nichts tun* — ein ehrlicher Hinweis ist besser als ein Knopf, der nichts
bewirkt.

Von Hand nachsehen: **Hilfe → Nach Updates suchen …**

Zwei Dinge, die zur Ehrlichkeit gehören:

- Es gibt **keine Meldung in dem Moment**, in dem eine Version veröffentlicht
  wird — dafür bräuchte es einen dauerhaft offenen Kanal zu jedem Gerät.
  OnTrack fragt regelmäßig nach; eine neue Fassung fällt innerhalb eines
  Arbeitstages auf, nicht in derselben Sekunde.
- Die Prüfung beim Start ist **stumm**. Wer OnTrack im Lager ohne Netz
  startet, bekommt keine Fehlermeldung — nur wer von Hand nachsieht, erfährt,
  dass die Verbindung fehlt.

**Einmal noch von Hand:** Das Selbstupdate steckt in der App und wirkt deshalb
erst ab der Fassung, die es mitbringt. Wer 1.0.0 oder 1.1.0 installiert hat,
lädt 1.2.0 einmalig hier herunter. Danach meldet sich OnTrack von allein.

## Was in 1.1.0 dazukam

Falls du direkt von 1.0.0 kommst — dazwischen liegt die Abarbeitung einer
kritischen Durchsicht der ganzen App ([AUDIT.md](AUDIT.md)):

- **Ein vergessenes Passwort sperrt nicht mehr aus.** Eigene Passwortänderung,
  Zurücksetzen durch den Admin.
- **Die Daten kommen wieder heraus.** Inventar als CSV und PDF, Packliste als
  Druckvorlage, Prüfnachweise für die DGUV-V3-Ablage.
- **Der Einsatzmodus:** ein laufender Auftrag statt vieler Bildschirme — jeder
  Scan hakt direkt ab, mit Ton und Fortschritt.
- **Ohne Empfang weiterarbeiten:** Scans werden vorgemerkt und nachgebucht.
- **Kabel und Kleinteile** nach Stückzahl, auf der Packliste und im
  Einsatzmodus. **Verleih** an Dritte. **Kalender** und **Karte**.
- **Sicherung**, die im Server-Betrieb von allein läuft.

## Aktualisieren

Neue Version über die alte installieren. Der Datenordner bleibt erhalten,
nötige Datenbank-Anpassungen laufen beim Start automatisch. Im Docker-Betrieb
genügt `docker compose up -d --build`.

## Lizenz

Der Quellcode ist einsehbar, aber nicht Open Source. Die veröffentlichten
Installer dürfen kostenfrei genutzt werden, auch im eigenen Unternehmen;
Weitergabe, Veränderung und Betrieb als Dienst für Dritte bedürfen der
Zustimmung. Einzelheiten in [LICENSE](LICENSE).
