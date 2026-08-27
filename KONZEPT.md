# OnTrack — Konzept

Inventar- und Einsatz-Tracking für Veranstaltungstechnik mit QR-Codes.
Stand: 23.07.2026 · Status: beschlossen mit Bezi

## Ziel

Jedes Gerät bekommt einen aufklebbaren QR-Code. Ein Scan mit dem Handy zeigt sofort:
Was ist das, wo ist es, wo soll es hin, ist es einsatzbereit? Beim Auf- und Abbau
wird per Scan abgehakt, Fehler werden direkt am Gerät gemeldet und mit Foto
dokumentiert. Jede Aktion ist einem Benutzer zugeordnet und nachvollziehbar.

## Grundsatzentscheidungen

| Thema | Entscheidung |
|---|---|
| Plattform | PWA (Web-App, auf Homescreen installierbar, Kamera-Scan im Browser) |
| Desktop | Vollwertige PC-Oberfläche ist Pflicht: Verwaltung, Tabellen, Planung am großen Bildschirm; Handy-Ansicht ist für Scannen/Abhaken vor Ort optimiert. Jede Seite wird in beiden Ansichten geprüft. |
| Hosting | Eigener VPS/Root-Server, Deployment per Docker |
| Entwicklung | Lokal auf dem Mac (`localhost`), Handy-Test im gleichen WLAN |
| Offline | V1 online-only; Offline-Puffer später als PWA-Ausbau |
| Standort | GPS-Snapshot bei jedem Scan **plus** gepflegte benannte Standorte |
| Accounts | Selbst-Registrierung, Nutzung erst nach Admin-Freigabe |
| Sprache | Deutsch |

## Rollen

- **Admin** — alles: Nutzer freischalten/verwalten, Geräte & Stammdaten, löschen
- **Techniker** — Geräte anlegen/bearbeiten, scannen, Status setzen, Fehler melden, Fotos
- **Helfer (nur lesen + abhaken)** — scannen, Infos sehen, Auf-/Abbau abhaken; nichts ändern/löschen

## Datenmodell (Kernobjekte)

- **Gerät**: Inventarnummer (→ QR-Code), Name, Kategorie, Seriennummer, Kaufdatum,
  Kaufpreis, Lieferant, Gewicht, Notizen, Dokumente; Status
  (`einsatzbereit | defekt gemeldet | gesperrt | in Reparatur | ausgemustert`);
  aktueller Standort; letzte GPS-Position ("zuletzt gesehen")
- **Mengenartikel**: wie Gerät, aber mit Stückzahl statt Einzel-QR (Kabel, Schellen …)
- **Case/Kit**: Gruppe von Geräten mit eigenem QR — ein Scan bucht den ganzen Inhalt
- **Standort**: benannter Ort (Lager Regal 3, Stadthalle Bühne links …), optional mit Koordinaten
- **Veranstaltung**: Name, Ort, Zeitraum; optional hochgeladener Veranstaltungsplan
  (Bild); zugewiesene Geräte = Packliste; pro Gerät Einsatzposition, Status
  (`geplant | gepackt | aufgebaut | abgebaut | zurück im Lager`) und optional
  eine X/Y-Position auf dem Plan (per Drag & Drop verschiebbar)
- **Wartung**: Intervalle pro Gerät (z. B. DGUV V3 alle 12 Monate), Fälligkeits-Dashboard
- **Fehlermeldung**: Gerät, Beschreibung, Fotos, Melder, Status im Defekt-Workflow
- **Historie**: jede Aktion mit Benutzer, Zeitstempel, ggf. GPS — pro Gerät einsehbar
- **Foto**: an Gerät, Fehlermeldung oder Event-Position hängend

## Features V1

1. Gerätedatenbank mit Stammdaten, Fotos, Historie
2. QR-Scan per Handykamera → Gerätedetail (Status, Standort, geplanter Einsatz)
3. GPS-Erfassung beim Scan + benannte Standorte, Kartenansicht "zuletzt gesehen"
4. Veranstaltungen mit Packlisten: zuweisen, per Scan abhaken (gepackt/aufgebaut/abgebaut/zurück), Fehlbestand-Erkennung nach Abbau
5. Defekt-Workflow: melden (mit Foto) → gesperrt → in Reparatur → einsatzbereit; gesperrte Geräte sind nicht einplanbar
6. Wartungsintervalle mit Dashboard "fällig / bald fällig"
7. Cases & Kits mit Sammel-Umbuchung per Case-Scan
8. Etikettendruck: QR-Codes als druckfertiges PDF (Bogen-Layout und einzeln), mit Name + Inventarnummer
9. Benutzerverwaltung: Registrierung, Admin-Freigabe, Rollen, Nutzerliste
10. Verfügbarkeits-Check: Konfliktwarnung, wenn ein Gerät für zwei zeitlich
    überlappende Veranstaltungen eingeplant wird
11. Fundmodus: Wer einen QR-Code ohne Login scannt, sieht nur
    "Eigentum von …, bitte melden unter …" (Kontaktdaten vom Admin konfigurierbar)
12. Baustellen-Modus als Designprinzip: dunkles Design, hoher Kontrast,
    große Touchflächen — bedienbar mit Handschuhen in dunkler Halle
13. Veranstaltungsplan: Bild (Bühnen-/Hallenplan) pro Event hochladen, Geräte
    als Marker darauf platzieren und per Drag & Drop verschieben; Marker-Tap
    öffnet das Gerät, Positionen sind jederzeit änderbar
14. CSV-Import mit freier Spalten-Zuordnung: Geräte aus CSV-Exporten anderer
    Software (Eventworx, Vectorworks, Excel …) importieren — Spalten werden
    per Vorschau den Gerätefeldern zugeordnet, Duplikate erkannt
15. Scan-Zuordnung mit Sammelliste: Scannen ist auch ein Zuordnungswerkzeug —
    Case scannen, dann Geräte nacheinander scannen. Die Scans landen erst in
    einer Sammelliste (mit Vorprüfung: bereit / schon im Case / in anderem
    Case / unbekannt); zugewiesen wird erst nach ausdrücklicher Bestätigung
    ("X Geräte jetzt zuordnen"). Umhängen aus fremden Cases nur per
    Einzel-Freigabe in der Liste. Keine Sofort-Zuweisung.
16a. NFC-Tags parallel zum QR-Code: Tags tragen dieselbe /d/-URL wie der
    QR-Code → Antippen öffnet auf iPhone UND Android die Geräteseite bzw. den
    Fundmodus (ohne App-Änderung, Betriebssystem-Funktion). Zusätzlich in der
    App (nur Android/Chrome, Web-NFC): "NFC lesen" auf den Scan-Seiten speist
    denselben Code-Pfad wie der QR-Scan (inkl. Sammelliste), und "NFC-Tag
    beschreiben" auf Geräte-/Case-Seiten schreibt die URL auf den Tag.
    iOS: Tags mit Dritt-App (z. B. NFC Tools) beschreiben. Hardware-Hinweis:
    On-Metal-Tags (NTAG21x mit Ferritschicht) für Metallgehäuse verwenden.

16b. Barcode-Scan: Der Kamera-Scanner liest neben QR auch 1D-Barcodes
    (EAN, Code 128 …). Gescannte Codes werden gegen Inventarnummer UND
    Seriennummer abgeglichen — Geräte lassen sich so auch über den
    aufgedruckten Hersteller-Barcode finden. (Begriffsklärung: Barcode/QR =
    Kamera/Optik; NFC = RFID-Nahfunk, bereits umgesetzt; UHF-RFID mit
    Metern Reichweite und Pulk-Erfassung = eigene Lesegeräte-Hardware → Roadmap.)

16c. MVR-Import (Vectorworks): Pro Event eine MVR-Datei importieren. Der
    Browser extrahiert per ZIP-Slicing NUR die GeneralSceneDescription.xml
    (beliebig große MVRs, kein Ressourcen-Entpacken, Datei wird nicht
    aufbewahrt). Filterdialog nach Layern/Klassen (nur Fixture-Einträge,
    kein Truss/Szenenobjekte). Gespeichert pro Fixture: Name, FixtureID,
    UUID, GDTF-Typ/Mode als Text, Layer, Klasse, DMX-Adressen, Endposition
    in Metern (Layer-/Gruppen-Transformationen einmultipliziert).
    Auto-Match zum Inventar nur über eindeutige Kennungen (Inventar-/
    Seriennummer im Fixture-Namen), Rest manuell. Aktionen: gematchte
    Geräte in die Packliste übernehmen, Positionen auf den
    Veranstaltungsplan übertragen (Grundriss normalisiert).

16. Technische Zusatzfelder mit Vererbung: Großer eingebauter Feldkatalog
    (DMX-Adresse/-Universum/-Modus, Leistung, Anschlusstyp, Leuchtmittel,
    Traglast, Kabellänge, Frequenzband, Akku u. v. m., gruppiert). Der Admin
    wählt pro Kategorie aus, welche Felder angezeigt werden; pro Gerät kann
    diese Auswahl bei Bedarf überschrieben werden (Default = Kategorie).
    Werte stehen auf der Gerätedetailseite als "Technische Daten".

## Roadmap

Stand 27.08.2026. Was umgesetzt ist, steht durchgestrichen — der Ausgangspunkt
bleibt lesbar, damit nachvollziehbar ist, was ursprünglich als „später"
eingeplant war.

**Umgesetzt:**

- ~~Offline-Modus (Scans puffern, synchronisieren)~~ → der Scan-Ablauf läuft
  ohne Netz; Nachschlagen und Fotos brauchen weiterhin Verbindung
- ~~Mengenartikel-Verwaltung mit Entnahme/Rückgabe~~ → inklusive Packliste,
  Einsatzmodus und Gewichtssumme
- ~~Export Inventarliste (Excel/PDF, z. B. für Versicherung)~~ → CSV und PDF,
  dazu Packliste und Prüfnachweise
- ~~Verleih/Checkout an Personen oder Fremdfirmen~~ → inklusive Warnung beim
  Einplanen eines verliehenen Geräts
- ~~Truck-Beladung: Gewichtssummen pro Event/Case~~
- ~~Kalenderansicht "Was ist wann wo im Einsatz"~~
- ~~Geräte klonen / Serien-Anlage (8 gleiche Lampen in einem Rutsch)~~
- ~~Stromlast-Summe pro Event aus gepflegten Wattzahlen~~
- ~~NFC-Tags als Alternative zum QR-Aufkleber~~ → in V1 übernommen (siehe 16a)

**Offen:**

- E-Mail-Benachrichtigungen (Wartung fällig, Fehler gemeldet) — setzt eine
  Mail-Infrastruktur voraus, die es nicht gibt; Push wäre der passendere Weg
- Push-Benachrichtigungen (Wartung fällig, Fehler gemeldet, Event-Erinnerung)
- Mietgeräte fürs Event erfassen (Verleiher, Rückgabedatum, Fälligkeits-Warnung)
- Aufgaben-Checklisten pro Event ("Strom legen", "Traverse hochziehen")
- Betriebsstunden & Zähler (Lampenstunden, Akkuzyklen) als Wartungsauslöser
- Schnellhilfe-Notizen am Gerät ("DMX-Adresse so einstellen …")
- Reparaturkosten-Historie mit Ausmusterungs-Hinweis
- Auslastungsstatistik (Dauerläufer vs. Regalhüter)

### Vectorworks-Integration (recherchiert 07/2026)

Vectorworks Spotlight ist der Branchenstandard für Veranstaltungsplanung und
bietet mehrere Andockpunkte:

1. **Geräteliste (Instrument Schedule)**: Spotlight exportiert Leuchten-Daten
   inkl. Position, Stromkreis, Zubehör als CSV/Tab-getrennte Datei →
   wird vom OnTrack-CSV-Import (V1) mit Vectorworks-Vorlage direkt gelesen;
   auch Tabellen/Arbeitsblätter lassen sich als CSV/TXT exportieren.
2. **MVR-Import (My Virtual Rig)** — Roadmap-Highlight: MVR ist ein offenes
   Containerformat (ZIP mit XML-Szenenbeschreibung + GDTF-Gerätedaten), das
   Vectorworks pro Show exportiert. Es enthält die komplette Geräteliste MIT
   Positionen. OnTrack könnte daraus automatisch ein Event samt Packliste
   erzeugen und die Marker auf dem Veranstaltungsplan vorplatzieren.
3. **Plan als Hintergrund**: Vectorworks-Pläne als PDF/Bild exportieren →
   direkt als Veranstaltungsplan in OnTrack hochladen (V1 bereits abgedeckt;
   PDF-zu-Bild-Unterstützung als Ausbau).
4. **GDTF-Gerätedaten**: offene Gerätebeschreibungen (Gewicht, Leistung …)
   könnten Stammdaten beim Anlegen vorbefüllen (Roadmap).
5. **Rückweg**: OnTrack-Packlisten als CSV exportieren, in Vectorworks-
   Arbeitsblätter einlesbar (Roadmap).

## Technik

- **App**: Next.js (React) als PWA — eine Codebase für Verwaltung (Desktop) und Scannen (Handy)
- **Datenbank**: SQLite über Prisma — eine Datei, triviale Backups, mehr als genug für diesen Einsatz; Wechsel auf Postgres jederzeit möglich
- **Fotos/Dokumente**: Dateisystem des Servers (Upload-Verzeichnis)
- **Login**: E-Mail + Passwort, Session-Cookies, Freigabe-Flag durch Admin
- **QR**: Scan mit `@zxing/browser` (Kamera im Browser), Erzeugung mit `qrcode`, PDF-Etiketten mit `pdf-lib`
- **Karte**: Leaflet + OpenStreetMap (kostenlos, kein API-Key)
- **Deployment**: Docker Compose auf dem VPS, HTTPS via Caddy/Traefik (nötig für Kamera- und GPS-Zugriff im Browser)
