OnTrack **1.2.1** — der Einsatzmodus führt jetzt bis zum Ende, und jede Aktion
sagt, dass sie gewirkt hat.

Diese Fassung geht auf eine echte Erstnutzung zurück: elf Minuten, zwölf
Protokolleinträge. Was dabei schieflief, ist hier behoben.

## Herunterladen

| System | Datei |
| --- | --- |
| macOS (Apple Silicon) | `OnTrack-1.2.1-arm64.dmg` |
| macOS (Intel) | `OnTrack-1.2.1.dmg` |
| Windows 10/11 | `OnTrack-Setup-1.2.1.exe` |
| Linux (universell) | `OnTrack-1.2.1.AppImage` |
| Debian / Ubuntu | `ontrack_1.2.1_amd64.deb` |

**Wer 1.2.0 installiert hat, muss hier nichts holen** — die App meldet sich
selbst. Unter Windows und Linux lädt und installiert sie das Update auf
Nachfrage, auf dem Mac öffnet sie diese Seite. Von Hand nachsehen:
**Hilfe → Nach Updates suchen …**

Die Installer sind nicht signiert. macOS: beim ersten Start Rechtsklick →
Öffnen. Windows: SmartScreen → Weitere Informationen → Trotzdem ausführen.
Einzelheiten in [DESKTOP.md](DESKTOP.md), Prüfsummen in `SHA256SUMS.txt`.

## Ein Einsatz hat jetzt ein Ende

Bisher meldete die Phase „Alle Geräte abgebaut" — und blieb dann stehen. Kein
Weg zur nächsten Phase, kein „fertig", der Scanner weiter im Bild. Ein Einsatz
vom Vorabend lief dadurch am nächsten Tag immer noch.

Ist die Phase abgearbeitet, tritt der Scanner zurück und der Abschluss
übernimmt: **„Zurückräumen beginnen"** als Hauptknopf, daneben Packliste,
„Trotzdem weiterscannen" für Nachzügler und „Einsatz beenden". Nach der letzten
Phase entfällt der Weiter-Knopf. Sind Kabel oder Kleinteile noch nicht
zurückgebucht, steht das dort ausdrücklich — das ist der Fehlbestand, um den es
geht.

## Eine leere Packliste ist kein Einsatz

Ein Einsatz ohne Soll kann nichts abhaken: Der Fortschritt bleibt bei 0/0, jedes
Gerät muss über einen Sonderweg aufgenommen werden, und der Abschluss kommt nie.
Genau das war passiert.

Die Startseite bietet in diesem Fall keine Phasen mehr an, sondern **„Erst
Geräte einplanen"**. Und der Server lässt es unabhängig davon nicht mehr zu —
egal, von welcher Seite gestartet wird. Mengenartikel zählen dabei mit: Eine
Packliste aus 200 Kabeln und keinem Gerät ist eine Packliste.

## Jede Aktion bestätigt sich

- **„Einsatz starten" führt jetzt in den Einsatz.** Vorher lud die Seite nur neu
  — man blieb stehen, nichts änderte sich sichtbar, und drückte ein zweites Mal.
- **„Einsatz beenden"** zeigt jetzt, dass es arbeitet.
- **Nach einer erfassten Prüfung** bleibt stehen, *was* gespeichert wurde:
  „Prüfung vom 28.08.2026 gespeichert — Bestanden, Elektro Müller GmbH."
  Vorher klappte das Formular nur zu; wer unsicher war, speicherte erneut — und
  im Prüfnachweis standen zwei Einträge derselben Prüfung.
- **Dieselbe Prüfung am selben Tag mit demselben Ergebnis** wird abgelehnt. Ein
  *anderes* Ergebnis bleibt erlaubt: durchgefallen, repariert, bestanden ist ein
  echter Ablauf. Bei einem Dokument, das im Schadensfall zählt, ist ein
  doppelter Nachweis kein Schönheitsfehler.

## Behoben

Beim Wechsel in die nächste Phase zeigte der Einsatzbildschirm kurzzeitig den
Fortschritt der *alten* Phase — „1/1, alles zurück im Lager", obwohl in der
neuen Phase noch nichts gebucht war. Die Daten waren korrekt, nur die Anzeige
nicht. Behoben.

## Aktualisieren

Neue Version über die alte installieren, oder das Selbstupdate machen lassen.
Der Datenordner bleibt erhalten, nötige Datenbank-Anpassungen laufen beim Start
automatisch. Im Docker-Betrieb genügt `docker compose up -d --build`.

## Lizenz

Der Quellcode ist einsehbar, aber nicht Open Source. Die veröffentlichten
Installer dürfen kostenfrei genutzt werden, auch im eigenen Unternehmen;
Weitergabe, Veränderung und Betrieb als Dienst für Dritte bedürfen der
Zustimmung. Einzelheiten in [LICENSE](LICENSE).
