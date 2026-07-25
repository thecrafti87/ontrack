# OnTrack deployen — Test-Instanz für Kunden-Feedback

Ziel: Die App läuft öffentlich mit HTTPS (damit Kamera-Scan, GPS und NFC
funktionieren) und aktualisiert sich **automatisch bei jedem Git-Push**.

## Variante A: Railway (empfohlen für den Start)

1. Auf https://railway.app mit deinem GitHub-Konto (thecrafti87) anmelden.
2. **New Project → Deploy from GitHub repo** → `thecrafti87/ontrack` wählen.
   Railway erkennt das Dockerfile automatisch und baut das Image.
3. Im Service unter **Settings → Volumes**: neues Volume anlegen,
   **Mount Path: `/app/data`** (hier landen Datenbank und Fotos —
   überlebt jedes Update).
4. Unter **Variables** setzen:
   - `DATABASE_URL` = `file:/app/data/db/ontrack.db`
5. Unter **Settings → Networking**: **Generate Domain** → du bekommst eine
   HTTPS-Adresse wie `ontrack-production-xxxx.up.railway.app`.
6. Fertig. Ab jetzt gilt: **jeder Push auf `main` → Railway baut und
   veröffentlicht automatisch die neue Version** (dauert ~2–3 Min).

Kosten: nutzungsbasiert, für diese App typischerweise ~5 $/Monat
(Hobby-Plan). Später jederzeit auf den eigenen VPS umziehbar — Datenbank
ist eine Datei, Fotos ein Ordner (per Railway-CLI oder Volume-Backup
herunterladbar).

## Variante B: Render

1. https://render.com → **New → Web Service** → GitHub-Repo verbinden.
2. Runtime: **Docker** (wird am Dockerfile erkannt).
3. **Disk** hinzufügen: Mount Path `/app/data`, Größe 1 GB reicht anfangs.
4. Environment Variable: `DATABASE_URL` = `file:/app/data/db/ontrack.db`
5. Auto-Deploy bei Push ist Standard. Hinweis: Persistent Disk erfordert
   den bezahlten Starter-Plan (~7 $/Monat); der Gratis-Plan verliert Daten
   und schläft ein — für den Kundentest ungeeignet.

## Nach dem ersten Start (wichtig!)

1. **Sofort selbst registrieren** — der ERSTE Account wird automatisch
   Admin. Die Live-Datenbank startet leer; die lokalen Demo-Daten bleiben
   auf deinem Mac.
2. Kunde registriert sich selbst → du schaltest ihn unter **Benutzer**
   frei (Rolle nach Bedarf: Techniker oder Helfer).
3. Unter **Einstellungen**: "App-Adresse für QR-Codes" auf die
   Railway-/Render-Domain setzen (wichtig vor dem Etikettendruck und
   NFC-Tag-Beschreiben) und die Fundmodus-Kontaktdaten eintragen.

## Später: Umzug auf eigenen VPS

Siehe README.md (docker compose + Caddy). Datenübernahme: Volume-Inhalt
(`/app/data`) vom Cloud-Dienst herunterladen und auf dem VPS in die
Volumes legen — fertig.
