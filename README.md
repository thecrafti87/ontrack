# OnTrack

Inventar- und Einsatz-Tracking für Veranstaltungstechnik mit QR-Codes.
Konzept und Feature-Liste: [KONZEPT.md](KONZEPT.md)

## Installieren

**Als Desktop-App** (macOS, Windows, Linux) — nichts weiter nötig, Installer
doppelklicken: **[Releases](https://github.com/thecrafti87/ontrack/releases)**.
Anleitung und Grenzen der Desktop-Version: [DESKTOP.md](DESKTOP.md).

**Als Server** (empfohlen, wenn Handys scannen sollen oder mehrere Personen
gleichzeitig arbeiten): siehe [Deployment](#deployment-auf-dem-vps-docker)
weiter unten.

Wann was passt:

| | Desktop-App | Server |
| --- | --- | --- |
| Einrichtung | Installer doppelklicken | Docker + Reverse-Proxy |
| Kamera-Scan am Handy | ❌ | ✅ |
| Standort beim Scan (GPS) | ❌ | ✅ |
| Mehrere Personen / Geräte | ❌ Daten bleiben lokal | ✅ |

## Lokal entwickeln & testen

```bash
npm install
npx prisma migrate dev   # legt die SQLite-Datenbank an (prisma/data/ontrack.db)
npm run dev              # → http://localhost:3000
```

Der **erste registrierte Benutzer** wird automatisch Admin und ist sofort
freigeschaltet. Alle weiteren Registrierungen müssen vom Admin unter
**Benutzer** freigeschaltet werden.

**Handy-Test im WLAN:** `npm run dev` läuft auch unter `http://<Mac-IP>:3000`.
Achtung: Kamera (QR-Scan) und GPS funktionieren im Browser nur über HTTPS
oder localhost — im WLAN ohne HTTPS die manuelle Inventarnummern-Eingabe auf
der Scan-Seite nutzen. Auf dem VPS mit HTTPS funktioniert beides.

## Deployment auf dem VPS (Docker)

```bash
docker compose up -d --build
```

Die App läuft dann auf Port 3000; Datenbank und Foto-Uploads liegen in
Docker-Volumes (`ontrack-db`, `ontrack-uploads`) und überleben Updates.

**HTTPS ist Pflicht** (Kamera + GPS): davor einen Reverse-Proxy setzen,
z. B. Caddy — kümmert sich automatisch um Zertifikate:

```
ontrack.beispiel.de {
    reverse_proxy localhost:3000
}
```

**Nach dem Deployment:** In der App unter **Einstellungen → App-Adresse für
QR-Codes** die echte Adresse (z. B. `https://ontrack.beispiel.de`) eintragen,
_bevor_ Etiketten gedruckt werden — sonst zeigen die QR-Codes auf localhost.

## Backup

Die gesamte Datenbank ist eine Datei. Sichern:

```bash
docker run --rm -v ontrack_ontrack-db:/db -v "$PWD":/backup alpine cp /db/ontrack.db /backup/ontrack-backup.db
```

Uploads analog aus dem Volume `ontrack_ontrack-uploads`.

## Technik

Next.js 16 (App Router) · Prisma 6 + SQLite · Tailwind CSS v4 · PWA
QR-Scan: @zxing/browser · Etiketten-PDF: pdf-lib + qrcode
Desktop-Build: Electron 43 + electron-builder

## Lizenz

Der Quellcode ist öffentlich einsehbar, aber **nicht Open Source**. Die
veröffentlichten Installer dürfen kostenfrei genutzt werden, auch im eigenen
Unternehmen. Weitergabe, Veränderung und der Betrieb als Dienst für Dritte
bedürfen der Zustimmung — siehe [LICENSE](LICENSE).
