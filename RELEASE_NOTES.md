OnTrack **1.1.0** — die erste Fassung, der man einen echten Bestand anvertrauen
kann. Zwischen 1.0.0 und hier liegt eine kritische Durchsicht der ganzen App
([AUDIT.md](AUDIT.md)) und deren Abarbeitung.

## Herunterladen

| System | Datei |
| --- | --- |
| macOS (Apple Silicon) | `OnTrack-1.1.0-arm64.dmg` |
| macOS (Intel) | `OnTrack-1.1.0.dmg` |
| Windows 10/11 | `OnTrack.Setup.1.1.0.exe` |
| Linux (universell) | `OnTrack-1.1.0.AppImage` |
| Debian / Ubuntu | `ontrack_1.1.0_amd64.deb` |

Die beiden `*-mac.zip` sind dieselben App-Bundles ohne DMG-Hülle.

Die Installer sind **nicht signiert**. macOS: beim ersten Start Rechtsklick →
Öffnen. Windows: SmartScreen → Weitere Informationen → Trotzdem ausführen.
Beides ist in [DESKTOP.md](DESKTOP.md) erklärt, ebenso die Prüfsummen in
`SHA256SUMS.txt`.

## Das Wichtigste zuerst

**Ein vergessenes Passwort sperrt nicht mehr aus.** In 1.0.0 gab es keinen Weg
zurück — weder für den Benutzer noch für den Admin. Jetzt: eigene
Passwortänderung unter `/konto`, Zurücksetzen durch den Admin mit einmalig
angezeigtem Startpasswort. Jede Änderung beendet die übrigen Sitzungen.

**Die Daten kommen wieder heraus.** Inventarliste als CSV und PDF, Packliste
als Druckvorlage, Prüfnachweise für die DGUV-V3-Ablage — jeweils für den ganzen
Bestand oder ein einzelnes Gerät.

**Die Anmeldung ist gegen Durchprobieren geschützt.** Fünf Fehlversuche je Konto
und 25 je Herkunftsadresse in 15 Minuten.

## Der Einsatzmodus

Die größte Änderung an der Bedienung. Statt sich die Arbeit aus Bildschirmen
zusammenzusuchen, die nach Datentypen sortiert sind, wählt man einmal einen
laufenden Auftrag — *packen*, *aufbauen*, *abbauen*, *zurückräumen*. Danach hakt
jeder Scan direkt ab, ohne Zwischenklick, mit Ton und Fortschritt. Das Dashboard
zeigt den laufenden Einsatz statt fünf Zählern.

Eine Regel trägt den Kern: **Ein Scan bucht nie rückwärts.** Ein beim Packen
gescanntes, längst aufgebautes Gerät wird nicht zurückgestuft, sondern als „war
schon eingepackt" gemeldet.

## Ohne Empfang weiterarbeiten

Bricht die Verbindung weg, werden Scans im Einsatzmodus vorgemerkt und
automatisch nachgebucht, sobald wieder Netz da ist. „Vorgemerkt" ist dabei ein
sichtbarer eigener Zustand und nicht als Erfolg getarnt — ohne Netz lässt sich
nicht prüfen, ob ein Gerät überhaupt zur Packliste gehört.

Was weiterhin Verbindung braucht: Packliste einsehen, Geräte nachschlagen,
Fotos, Defektmeldungen.

## Neu im Bestand

- **Kabel und Kleinteile** nach Stückzahl führen, mit Entnahme, Rückgabe,
  Zugang und Inventurkorrektur. Der Bestand wird nie direkt gesetzt, sondern
  ergibt sich aus den Bewegungen — nur so lässt sich beantworten, wohin die 40
  Kabel gegangen sind. Sie stehen jetzt auch auf der Packliste, im Einsatzmodus
  und in der Gewichtssumme.
- **Verleih** an Personen oder Firmen mit Rückgabefrist, Teilrückgaben je Gerät
  und Überfälligkeit in Tagen. Ein verliehenes Gerät lässt sich nicht mehr
  unbemerkt für eine Veranstaltung einplanen.
- **Kalender** — Monatsansicht am Desktop, Tagesliste am Handy.
- **Karte** „zuletzt gesehen" mit Leaflet und OpenStreetMap statt eines Links
  auf einen fremden Dienst. (Positionen entstehen nur beim Scannen über HTTPS.)
- **Gewicht und Stromlast** je Veranstaltung und Case, mit grober Stromaufnahme
  bei 230 V und der Zahl nötiger 16-A-Kreise. Eine unvollständige Summe trägt
  ein „≥", und die Zahl der Geräte ohne Angabe steht gleichberechtigt daneben.
- **Serien-Anlage** — acht gleiche Scheinwerfer in einem Zug.
- **Prüfprotokolle** statt nur eines Datums, inklusive Entsperren nach
  bestandener Nachprüfung.

## Sicherung, die von allein läuft

Im Server-Betrieb sichert OnTrack jetzt täglich selbst und hebt die letzten 14
Stände auf. Wichtiger als der Zeitplan ist das *Wie*: Gesichert wird per
`VACUUM INTO`, nicht per Dateikopie. Eine laufende Datenbank zu kopieren ergibt
im besten Fall einen veralteten Stand und im schlechtesten einen unbrauchbaren —
und man merkt es erst, wenn man ihn braucht. Das README beschreibt auch das
Zurückspielen; eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung.

Die Desktop-App sichert weiterhin auf Knopfdruck, jetzt aber auf demselben Weg.
Eine automatische Sicherung gibt es dort nicht.

## Bedienung

- Geräteliste: Suchfeld und *ein* Filter-Knopf statt vier Bedienelementen
  übereinander. Die Zeilen zeigen Case beziehungsweise Standort, den nächsten
  Einsatz mit Datum und „Prüfung fällig" bei überfälliger Wartung.
- Navigation nach Zweck geordnet: vier tägliche Ziele sichtbar, der Rest in den
  Gruppen „Bestand" und „Verwaltung".
- Der Feedback-Knopf schwebt nicht mehr über jeder Seite.
- Die Scan-Seite benennt die tatsächliche Ursache, wenn die Kamera nicht kann —
  vorher schickte sie einen auf Android in die iPhone-Einstellungen.

## Unter der Haube

208 automatische Tests statt keiner, bei jedem Push geprüft. Dabei gefunden und
behoben: ein Rechenfehler, der jede Prüffrist auf einem Monatsletzten bei jedem
Durchlauf ein paar Tage nach hinten schob — bei einer DGUV-V3-Frist keine
Kleinigkeit.

## Aktualisieren von 1.0.0

Neue Version einfach über die alte installieren. Der Datenordner bleibt
erhalten, nötige Datenbank-Anpassungen laufen beim Start automatisch. Im
Docker-Betrieb genügt `docker compose up -d --build`.

## Lizenz

Der Quellcode ist einsehbar, aber nicht Open Source. Die veröffentlichten
Installer dürfen kostenfrei genutzt werden, auch im eigenen Unternehmen;
Weitergabe, Veränderung und Betrieb als Dienst für Dritte bedürfen der
Zustimmung. Einzelheiten in [LICENSE](LICENSE).
