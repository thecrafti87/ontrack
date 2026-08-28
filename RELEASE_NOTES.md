OnTrack **1.3.0** — die App erklärt sich jetzt selbst.

Zusammen mit 1.2.1 ist das die Abarbeitung einer Durchsicht der Bedienung: Wo
muss man raten, wo muss man wissen, wo bekommt man keine Antwort? Grundlage war
eine echte Erstnutzung, kein Katalog von Vermutungen.

## Herunterladen

| System | Datei |
| --- | --- |
| macOS (Apple Silicon) | `OnTrack-1.3.0-arm64.dmg` |
| macOS (Intel) | `OnTrack-1.3.0.dmg` |
| Windows 10/11 | `OnTrack-Setup-1.3.0.exe` |
| Linux (universell) | `OnTrack-1.3.0.AppImage` |
| Debian / Ubuntu | `ontrack_1.3.0_amd64.deb` |

**Ab 1.2.0 meldet sich die App selbst** — unter Windows und Linux lädt und
installiert sie das Update auf Nachfrage, auf dem Mac öffnet sie diese Seite.
Von Hand: **Hilfe → Nach Updates suchen …**

Die Installer sind nicht signiert. macOS: beim ersten Start Rechtsklick →
Öffnen. Windows: SmartScreen → Weitere Informationen → Trotzdem ausführen.
Einzelheiten in [DESKTOP.md](DESKTOP.md), Prüfsummen in `SHA256SUMS.txt`.

## Planen und Arbeiten sind getrennt

Die Seite einer Veranstaltung zeigte bisher alles gleichzeitig: „Geräte
hinzufügen" direkt neben dem Abhaken, „Plan hochladen" neben der Gefahrenzone.
In der Halle braucht niemand Verwaltungsknöpfe — und beim Verladen gehören die
Knöpfe, die den Bestand ändern, nicht unter die Finger.

Jetzt drei Reiter:

| | |
| --- | --- |
| **Packliste** | Einsatz starten, Gewicht & Strom, Fortschritt, Geräte, Kabel & Kleinteile, PDF-Druck |
| **Planung** | Veranstaltung bearbeiten, Geräte hinzufügen, Rig (MVR), Gefahrenzone |
| **Hallenplan** | Plan hochladen, Geräte als Marker setzen |

Der Reiter steht in der Adresse, ein Link auf die Packliste landet also auch
dort.

## Leere Seiten erklären, wofür es das gibt

„0 Cases · Keine Cases gefunden" beantwortet die Frage nicht, die jemand hat,
der zum ersten Mal davorsteht. Eine leere Seite ist die beste Gelegenheit zu
erklären — später schaut niemand mehr hin. Cases, Standorte, Geräte und
Veranstaltungen sagen jetzt, wofür es sie gibt, und bieten den ersten Schritt
an.

Dabei unterscheidet die App zwei Fälle, die vorher gleich aussahen: **„noch
nichts da"** und **„der Filter trifft nicht"**. Wer „Lege dein erstes Gerät an"
liest, während 300 im Bestand stehen, hält die App für kaputt.

## Kleinigkeiten mit Wirkung

- **Der große Knopf in der unteren Leiste hat eine Beschriftung** — „Einsatz"
  bzw. „Scannen". Er war der auffälligste und zugleich der einzige ohne Wort.
- **Die Blase daran erscheint erst ab eins.** Vorher meldete sie „0", sobald
  eine Phase erledigt war — eine Blase, die null anzeigt, macht jede weitere
  unglaubwürdig.
- **Die Standorte-Seite beginnt nicht mehr mit einem Formular.** Erst die
  Liste, das Anlegen hinter einem Knopf, und die Koordinaten eingeklappt unter
  „Auf der Karte zeigen (optional)" — für einen Lagerplatz im eigenen Haus
  braucht sie niemand.

## Aus 1.2.1, falls übersprungen

- **Ein Einsatz hat ein Ende.** Ist die Phase abgearbeitet, tritt der Scanner
  zurück: „Zurückräumen beginnen" oder „Einsatz beenden". Vorher lief ein
  Einsatz weiter, bis jemand daran dachte.
- **Eine leere Packliste lässt sich nicht mehr abarbeiten** — es gäbe nichts
  abzuhaken.
- **Jede Aktion bestätigt sich.** „Einsatz starten" führt in den Einsatz, und
  nach einer erfassten Prüfung steht da, *was* gespeichert wurde. Derselbe
  Nachweis am selben Tag wird abgelehnt; ein anderes Ergebnis bleibt erlaubt.

## Aktualisieren

Neue Version über die alte installieren, oder das Selbstupdate machen lassen.
Der Datenordner bleibt erhalten, nötige Datenbank-Anpassungen laufen beim Start
automatisch. Im Docker-Betrieb genügt `docker compose up -d --build`.

## Lizenz

Der Quellcode ist einsehbar, aber nicht Open Source. Die veröffentlichten
Installer dürfen kostenfrei genutzt werden, auch im eigenen Unternehmen;
Weitergabe, Veränderung und Betrieb als Dienst für Dritte bedürfen der
Zustimmung. Einzelheiten in [LICENSE](LICENSE).
