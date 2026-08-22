Erste öffentliche Version von **OnTrack** — Inventar- und Einsatz-Tracking für
Veranstaltungstechnik, jetzt auch als Desktop-App für macOS, Windows und Linux.

## Herunterladen

| System | Datei |
| --- | --- |
| macOS (Apple Silicon) | `OnTrack-1.0.0-arm64.dmg` |
| macOS (Intel) | `OnTrack-1.0.0.dmg` |
| Windows 10/11 | `OnTrack.Setup.1.0.0.exe` |
| Linux (universell) | `OnTrack-1.0.0.AppImage` |
| Debian / Ubuntu | `ontrack_1.0.0_amd64.deb` |

Die beiden `*-mac.zip` sind dieselben App-Bundles ohne DMG-Hülle — nur
nötig, wenn du die App ohne Installer entpacken willst.

Die Installer sind **nicht signiert**. macOS: beim ersten Start Rechtsklick →
Öffnen. Windows: SmartScreen → Weitere Informationen → Trotzdem ausführen.
Beides ist in [DESKTOP.md](DESKTOP.md) erklärt, ebenso die Prüfsummen in
`SHA256SUMS.txt` zum Abgleich.

## Was drin ist

- **Geräte** mit Fotos, Historie, Standorten, Seriennummern und frei
  konfigurierbaren Zusatzfeldern je Kategorie
- **QR-Etiketten** als PDF (A4-Bogen Avery und Brother-Einzeldruck) sowie
  NFC-Tags beschreiben
- **Scannen** per Kamera mit Fundmodus für verlorene Geräte
- **Events** mit Packlisten, Konfliktwarnung bei Doppelbuchung und Planbrett
- **Cases** mit Sammel-Umbuchung und Scan-Zuordnung
- **Wartung** mit Fristen-Dashboard und Defekt-Workflow
- **MVR-Import** aus Vectorworks inklusive Soll-/Ist-Montagestatus
- **CSV-Import**, Benutzerverwaltung mit Freigabe durch den Admin

## Die Desktop-App im Vergleich zum Server-Betrieb

Die Desktop-App läuft auf einem Rechner und speichert alles lokal — kein
Server, keine Cloud, keine Einrichtung. Zwei Unterschiede solltest du kennen:

- **GPS steht nicht zur Verfügung.** Electron liefert Chromium ohne
  Google-Standortdienst aus. Scans werden normal erfasst, nur ohne
  Koordinaten.
- **Handys erreichen die App nur über Datei → Im Netzwerk freigeben**, und
  dort ohne HTTPS — also ohne Kamera-Scan, nur mit manueller Eingabe.

Wer den Handy-Scan im Alltag braucht oder mit mehreren Personen auf denselben
Bestand zugreift, betreibt OnTrack weiterhin als Server: `docker compose up -d`
plus Reverse-Proxy, siehe [README.md](README.md).

## Daten und Sicherung

Die Datenbank ist eine einzelne Datei im Benutzerordner und überlebt jedes
Update. **Datei → Datenbank sichern …** legt eine Kopie an. Eine automatische
Sicherung gibt es nicht.

## Lizenz

Der Quellcode ist einsehbar, aber nicht Open Source. Die veröffentlichten
Installer dürfen kostenfrei genutzt werden, auch im eigenen Unternehmen;
Weitergabe, Veränderung und Betrieb als Dienst für Dritte bedürfen der
Zustimmung. Einzelheiten in [LICENSE](LICENSE).
