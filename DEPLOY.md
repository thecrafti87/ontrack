# OnTrack deployen — Test-Instanz für Kunden-Feedback

Ziel: Die App läuft öffentlich mit HTTPS — ohne das gibt es weder
Kamera-Scan noch GPS noch NFC.

**Welche Variante?**

| | Wann |
| --- | --- |
| **C — Cloudflare Tunnel** | Du hast eine Maschine, die ohnehin läuft (NAS, Mini-PC, VPS). Kostet nur die Domain, die Daten bleiben bei dir. *Empfohlen.* |
| **A — Railway** | Keine eigene Maschine, soll einfach laufen. ~5 $/Monat, baut bei jedem Push automatisch neu. |
| **B — Render** | Wie A, andere Anbieter-Vorliebe. |

## Variante A: Railway (gehostet, ohne eigene Maschine)

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

## Variante C: Eigener Rechner hinter einem Cloudflare Tunnel (empfohlen)

Die App läuft auf einer Maschine, die dir gehört — NAS, Mini-PC, alter
Laptop, VPS. Cloudflare liefert Domain, HTTPS und Schutz davor. **Im Router
muss nichts freigegeben werden**, und eine feste IP braucht es auch nicht:
Der Tunnel baut die Verbindung von innen nach außen auf.

Warum das für OnTrack der naheliegende Weg ist: Die App ist ein Node-Server
mit einer SQLite-Datei und einem Ordner für Fotos. Sie will ein
Dateisystem — und bekommt es hier, ohne dass am Datenmodell etwas geändert
werden muss.

### 1. Tunnel anlegen

Im Cloudflare-Dashboard: **Zero Trust → Networks → Tunnels → Create a
tunnel** → *Cloudflared* wählen, Namen vergeben (z. B. `ontrack`).

Cloudflare zeigt danach einen Installationsbefehl mit einem langen Token.
**Nur den Token brauchst du** — den Rest übernimmt Docker.

### 2. Öffentliche Adresse zuordnen

Im selben Dialog unter **Public Hostnames**:

| Feld | Wert |
| --- | --- |
| Subdomain | z. B. `ontrack` |
| Domain | deine bei Cloudflare verwaltete Domain |
| Service Type | `HTTP` |
| URL | `ontrack:3000` |

`ontrack:3000` ist der Dienstname aus der `docker-compose.yml` — der Tunnel
läuft im selben Docker-Netz und erreicht die App darüber direkt.

### 3. Token hinterlegen und starten

Eine Datei `.env` **neben** der `docker-compose.yml` (nicht im Repo, sie ist
per `.gitignore` ausgeschlossen):

```bash
TUNNEL_TOKEN=eyJhIjoiXXXXXXXX…

# Optional: Benachrichtigung bei neuem Feedback (siehe unten)
ONTRACK_RESEND_KEY=re_XXXXXXXX
ONTRACK_MAIL_TO=du@deine-domain.de
```

Dann:

```bash
docker compose --profile tunnel up -d --build
```

Ohne `--profile tunnel` startet alles wie bisher, nur ohne Tunnel — die
Datei taugt also für beide Betriebsarten.

### 4. Prüfen

```bash
docker compose logs -f tunnel
```

Erscheint `Registered tunnel connection`, steht die Verbindung. Danach die
Adresse im Browser aufrufen — es muss **https://** sein, sonst gibt es
keinen Kamera-Scan und kein GPS.

### Was das kostet

Der Tunnel ist kostenlos. Bezahlt wird nur die Domain. Strom für die
Maschine, die ohnehin läuft, kommt dazu.

### Grenzen

Die Maschine muss laufen. Steht sie, ist OnTrack weg — anders als bei einem
gehosteten Dienst. Für eine Test-Instanz und den eigenen Betrieb ist das
meist in Ordnung; für Kunden, die sich darauf verlassen, eher nicht.

## Benachrichtigung bei neuem Feedback

Ohne diese beiden Werte wird Feedback nur gespeichert — still, ohne
Fehlermeldung. Das ist der Normalfall für die Desktop-App.

| Variable | Bedeutung |
| --- | --- |
| `ONTRACK_RESEND_KEY` | API-Schlüssel von [resend.com](https://resend.com) (kostenloses Kontingent reicht) |
| `ONTRACK_MAIL_TO` | Deine Adresse — dorthin geht jede Meldung |
| `ONTRACK_MAIL_FROM` | Optional. Ohne eigene verifizierte Domain leer lassen; dann verschickt Resend über `onboarding@resend.dev`, allerdings **nur an die Adresse deines Resend-Kontos**. |

Die Mail trägt die Meldung schon im Betreff, dazu Verfasser, Seite und
Zeitpunkt — und als Antwortadresse den, der sie geschrieben hat. Eine
Antwort geht also direkt zurück.

Schlägt der Versand fehl, steht das im Container-Protokoll
(`docker compose logs ontrack`). Das Feedback selbst ist da: Es wird
gespeichert, **bevor** die Mail versucht wird.

## Nach dem ersten Start (wichtig!)

1. **Sofort selbst registrieren** — der ERSTE Account wird automatisch
   Admin. Die Live-Datenbank startet leer; die lokalen Demo-Daten bleiben
   auf deinem Mac.
2. Kunde registriert sich selbst → du schaltest ihn unter **Benutzer**
   frei (Rolle nach Bedarf: Techniker oder Helfer).
3. Unter **Einstellungen**: "App-Adresse für QR-Codes" auf die echte
   Adresse setzen (wichtig vor dem Etikettendruck und
   NFC-Tag-Beschreiben) und die Fundmodus-Kontaktdaten eintragen.
   Sonst zeigen die Aufkleber auf `localhost` — und ein aufgeklebter
   QR-Code lässt sich schlecht zurückrufen.

## Später: Umzug auf eigenen VPS

Siehe README.md (docker compose + Caddy). Datenübernahme: Volume-Inhalt
(`/app/data`) vom Cloud-Dienst herunterladen und auf dem VPS in die
Volumes legen — fertig.
