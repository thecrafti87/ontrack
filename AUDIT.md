# OnTrack — kritische Durchsicht und Plan zum fertigen Produkt

Stand: 23.08.2026 · Geprüfte Fassung: v1.0.0 (Commit `1de388e`)
Grundlage: Begehung der App am Handy und am Desktop, Durchsicht von 98 Quelldateien
(≈ 11.800 Zeilen), Datenmodell, Abgleich mit KONZEPT.md.

---

## Kurzfassung

OnTrack kann fachlich viel — mehr als die meisten Werkzeuge in dieser Preisklasse.
Was fehlt, ist nicht Funktionsumfang. Es fehlt an drei Stellen:

1. **Die App ist als Datenbank-Oberfläche gebaut, nicht als Werkzeug für Arbeitsabläufe.**
   Das ist die Ursache dafür, dass sich die Bedienung umständlich anfühlt — und der
   Grund, warum zusätzliche Funktionen es zunächst schlimmer machen würden.
2. **Ein vergessenes Passwort sperrt dauerhaft aus.** Es gibt keinen Weg zurück —
   weder für den Benutzer noch für den Admin. Das ist ein Auslieferungshindernis.
3. **Daten kommen rein, aber nicht raus.** Kein Export in irgendeiner Form.

Punkt 1 ist die eigentliche Antwort auf „soll maximal einfach sein". Punkte 2 und 3
sind Pflicht, bevor jemand ernsthaft damit arbeitet.

---

## Die Diagnose: Bildschirme statt Abläufe

Die Navigation bildet das **Datenmodell** ab: Geräte, Cases, Standorte, Events,
Wartung, Etiketten, Import. Die Arbeit sieht aber anders aus:

> einpacken → hinfahren → aufbauen → Show → abbauen → zurückräumen → prüfen

Kein einziger dieser Schritte hat in der App einen eigenen Ort. Man muss ihn sich
aus Bildschirmen zusammensuchen, die nach Datentypen sortiert sind. Konkret:

| Beobachtung | Folge in der Praxis |
|---|---|
| Der Scan ist **kontextlos** — er landet immer auf der Geräteseite, egal warum gescannt wurde | Beim Packen scannt man ein Gerät und muss danach selbst zur Packliste navigieren und dort abhaken |
| Die Event-Seite mischt **Planung und Ausführung** („Geräte hinzufügen" steht neben „abhaken") | In der Halle sieht man Verwaltungsfunktionen, die man dort nie braucht |
| Die Packliste zeigt nur **zugeklappte Kategoriegruppen** mit Zählern | Die eigentliche Arbeitsliste ist zwei Tipps entfernt |
| Das Dashboard zeigt **fünf Zähler**, vier davon auf 0 | Es beantwortet nicht „was ist jetzt zu tun" |
| „Alle als gepackt markieren" ist der **auffälligste Knopf** auf der Event-Seite | Ein Fehltipp entwertet den gesamten Abhak-Ablauf |

**Der Hebel:** Die App braucht einen *laufenden Auftrag*. Man sagt einmal „ich packe
für Pirelli BV" — danach weiß jeder Scan, was er bedeutet, und das Dashboard zeigt
den Fortschritt statt Zähler. Das ist eine Änderung, keine zwanzig, und sie macht
die Bedienung an genau der Stelle einfacher, an der es zählt.

---

## A — Auslieferungshindernisse

Diese Punkte sind keine Geschmacksfrage. Solange sie offen sind, sollte niemand
seinen Bestand ernsthaft in OnTrack führen.

### A1 · Vergessenes Passwort sperrt dauerhaft aus — ✅ behoben (23.08.2026)

Es gibt **keinerlei** Wiederherstellung: kein „Passwort vergessen", kein Ändern im
angemeldeten Zustand, und der Admin kann in der Benutzerverwaltung nur freischalten,
Rolle ändern, deaktivieren und löschen — kein Zurücksetzen.

*Belegt:* In deiner lokalen Konfiguration stehen zwei `sqlite3`-Befehle, mit denen ein
Passwort-Hash direkt in der Datenbank überschrieben wurde. Der Fall ist also nicht
theoretisch — er ist schon eingetreten, und die Lösung war Datenbank-Chirurgie.

**Nötig:** Admin kann ein Passwort zurücksetzen (Einmal-Link oder gesetztes
Startpasswort) · Benutzer kann sein Passwort ändern · Mindestens ein Admin muss
immer existieren.

**Umgesetzt:** `/konto` für die eigene Passwortänderung (mit Abfrage des alten),
Zurücksetzen durch den Admin mit einmalig angezeigtem Startpasswort. Jede Änderung
beendet die übrigen Sitzungen des Betroffenen. Kein E-Mail-Versand — die App hat
keine Mail-Infrastruktur, die Desktop-Fassung könnte gar keine verschicken.

**Korrektur zu diesem Befund:** Der Zusatz „der letzte Admin kann sich selbst
löschen" war **falsch**. Herabstufen und Deaktivieren des letzten freigeschalteten
Admins sind bereits blockiert (`countOtherApprovedAdmins`), Selbstlöschen und
Selbstdeaktivieren ebenfalls. Ich hatte das behauptet, ohne es zu prüfen. Das
Verhalten ist jetzt durch Tests abgesichert.

### A2 · Kein Export — ✅ behoben (23.08.2026)

CSV-Import und MVR-Import sind da, aber es gibt keinen Weg heraus. Für den
Versicherungsfall, die Steuer, eine Übergabe oder schlicht das Vertrauen, dass die
Daten dir gehören, ist das zu wenig.

**Nötig:** Inventarliste als CSV und als PDF · Packliste eines Events als PDF
(die nimmt man ohnehin ausgedruckt mit) · Prüfnachweise als PDF-Sammlung.

**Umgesetzt:** `/api/export/inventar?format=csv|pdf` und
`/api/export/packliste/[eventId]`. Der Export umfasst immer den ganzen Bestand,
nie den eingestellten Listenausschnitt. **Offen geblieben:** die Prüfnachweise als
PDF-Sammlung — die gehören zu den Prüfprotokollen und folgen dort.

### A3 · Anmeldung ungeschützt — ✅ behoben (23.08.2026)

Kein Rate-Limiting. Passwörter lassen sich beliebig oft durchprobieren. Sobald die
Instanz öffentlich erreichbar ist, ist das eine offene Tür.

**Umgesetzt:** `src/lib/rateLimit.ts` — 5 Fehlversuche je Konto und 25 je
Herkunftsadresse in 15 Minuten. Im Arbeitsspeicher statt in der Datenbank, weil
OnTrack als einzelner Prozess läuft; ein Neustart setzt die Zähler zurück, was
vertretbar ist, da ein Angreifer ihn nicht auslösen kann. Die Bremse greift vor der
Datenbankabfrage und unabhängig davon, ob das Konto existiert — sonst verriete die
Sperrmeldung, welche Adressen registriert sind.

### A4 · Keine automatisierten Tests — ✅ Grundstock steht (23.08.2026)

Null Testdateien bei 98 Quelldateien. Jede Änderung wird von Hand nachgeprüft oder
gar nicht. Bei einem System, das Bestandsdaten führt, ist das auf Dauer nicht haltbar.

**Nötig:** Kein Vollausbau — aber die rechnenden und buchenden Teile gehören
abgesichert: Fälligkeitsberechnung, Konflikterkennung, Case-Umbuchung, CSV-Import,
Rechteprüfung.

**Umgesetzt:** Vitest mit 63 Tests in 7 Dateien. Abgedeckt: Anmeldebremse,
CSV-Erzeugung, Wartungsfristen und Prüfergebnisse, Statusketten und Gruppierung,
PDF-Zeichensatz und Seitenumbruch, Zerlegung der Migrations-SQL. Die
Konflikterkennung steckt in einer Prisma-Abfrage und wird deshalb als
Integrationstest gegen eine echte SQLite-Datei geprüft, nicht mit Attrappen.
`npm test`, in der CI bei jedem Push und als Sperre vor jedem Release.

**Dabei gefunden — ein echter Rechenfehler:** `addMonths` ließ den 30. November
plus drei Monate auf den 2. März überlaufen statt auf den 28. Februar
(JavaScripts `setMonth` normalisiert den 30. Februar stillschweigend weiter). Jede
Prüffrist, die auf einen Monatsletzten fällt, wanderte damit bei jedem Durchlauf
nach hinten — bei einer DGUV-V3-Frist keine Kleinigkeit. Behoben und mit
Grenzfällen inklusive Schaltjahr abgesichert.

**Offen:** Case-Umbuchung und CSV-Import sind noch nicht abgedeckt. Beide stecken
in Server-Aktionen, die `requireUser` aufrufen und deshalb einen Request-Kontext
brauchen; das ist eigene Vorarbeit wert.

### A5 · Keine Sicherung im laufenden Betrieb

Die Desktop-App kann von Hand sichern, sonst gibt es nichts. Kein Zeitplan, keine
Erinnerung, keine Aufbewahrung mehrerer Stände.

---

## B — Bedienung

Sortiert nach Wirkung. Alles hier ist am Gerät nachgestellt und belegt.

### B1 · Das Dashboard beantwortet die falsche Frage

Fünf Zählerkacheln (vier auf 0), ein Begrüßungsband, ein großer Scan-Knopf — der
sich mit dem Scan-Knopf in der unteren Leiste doppelt. Der einzige inhaltlich
nützliche Teil, die anstehenden Events, steht unterhalb des sichtbaren Bereichs.

**Statt dessen:** Was läuft gerade, was ist als Nächstes dran, was blockiert.
Zähler auf das, was wirklich Handlung auslöst (überfällige Prüfungen, gesperrte
Geräte). „Offene Feedbacks" gehört nicht auf die Startseite eines Technikers.

### B2 · Listen beginnen mit einer Filterwand

Die Geräteliste zeigt vier Bedienelemente übereinander — Suche, Kategorie,
Sortierung, Status-Chips — bevor ein einziges Gerät erscheint. Auf dem Handy ist die
Chip-Reihe abgeschnitten („Gesperr…"), der Suchtext ebenfalls („…Kate").

**Statt dessen:** Suche sichtbar, alles andere hinter *einem* Filter-Knopf mit
Trefferanzahl. Und die Zeilen sollten zeigen, was im Einsatz zählt: in welchem Case,
auf welchem Event, Prüfung fällig — statt nur des Status.

### B3 · Die untere Leiste passt nicht zur Arbeit — verschärft (23.08.2026)

„Events" hat einen festen Platz, obwohl man es selten öffnet; „Cases", „Standorte",
„Wartung", „Etiketten" liegen alle unter „Mehr" — einer flachen Liste aus acht
Einträgen ohne Ordnung. Zusätzlich überlappt das Benutzer-Kürzel („N") die
Beschriftung „Start".

**Nachgemessen (23.08.2026):** Auch die *Desktop*-Leiste reichte nicht. Bei 1100 px
Fensterbreite brauchte die Navigation 903 px in einem 758 px breiten Bereich.
„Einstellungen" und „Feedback" lagen außerhalb des sichtbaren Bereichs.

**Berichtigung meiner ersten Fassung:** Ich hatte geschrieben, „Feedback" sei
dadurch **unerreichbar**. Das war falsch. Die Leiste trug bereits
`overflow-x-auto` und ließ sich um 144 px seitwärts scrollen; die Einträge waren
also erreichbar — nur ohne sichtbare Scrollleiste und ohne Mausrad-Unterstützung
praktisch verborgen. Schlecht auffindbar, nicht unbedienbar. Ich hatte
geschlossen, ohne den Scrollweg zu prüfen.

**Behoben (23.08.2026):** Die Leiste bricht jetzt um statt zu scrollen
(`flex-wrap`, Kopfhöhe wächst mit). Geprüft bei 820, 1100 und 1500 px: kein
Überlauf, kein verdeckter Eintrag, kein waagerechtes Scrollen der Seite. Ab
etwa 1400 px bleibt es bei einer Reihe. Die eigentliche Neuordnung der
Navigation bleibt Teil dieses Befunds.

### B4 · Der Feedback-Knopf steht überall im Weg

Er schwebt auf jeder Seite über dem Inhalt, ist genauso auffällig wie der Scan-Knopf
und verdeckt auf mehreren Seiten Text. Er war für den Kundentest gedacht — im
Produkt gehört er in die Fußzeile oder unter „Mehr".

### B5 · Die Scan-Seite hilft nicht, wenn sie nicht kann

Schlägt der Kamerazugriff fehl, erscheint der technische Fehlertext
(`NotAllowedError: Permission denied`) und eine iPhone-Anleitung — auch auf Android
und am Desktop. Darunter ist die Seite leer.

### B6 · Fehlende Seitentitel

`/login`, `/register` und `/scan` haben keinen Seitentitel; im Browser-Tab steht nur
„OnTrack". (Bekannt aus dem UI-Audit vom Juli, seither offen.)

### B7 · Bestandene Prüfung entsperrt nicht

Neu aufgefallen beim Bau der Prüfprotokolle: Ein durchgefallenes Gerät lässt sich
mit einem Haken sperren — aber nach bestandener Nachprüfung gibt es kein Gegenstück.
Das Entsperren bleibt Handarbeit an einer anderen Stelle.

---

## C — Fachliche Lücken

### C1 · Kabel und Kleinteile lassen sich nicht führen

Jedes Objekt braucht eine eigene Inventarnummer mit eigenem QR-Code. Für 200
DMX-Kabel, Schellen, Klemmen oder Gaffa ist das unbrauchbar — und genau diese Dinge
gehen verloren. Mengenartikel mit Stückzahl statt Einzelnummer stehen seit V1 auf
der Roadmap.

### C2 · Gewicht und Stromlast werden erfasst, aber nicht genutzt

Das Gewichtsfeld pflegst du, Leistung steckt im Feldkatalog. Summiert ergäben sie
Ladungsplanung für den LKW und eine Warnung, bevor eine Zuleitung überlastet wird.
Die Daten liegen ungenutzt herum — fachlich das Eigenständigste, was die App
kurzfristig gewinnen könnte.

### C3 · Kein Blick auf die Zeitachse

Es gibt keine Kalenderansicht. „Was ist wann wo im Einsatz" lässt sich nur
Event für Event beantworten.

### C4 · Ohne Empfang steht alles

Im Hallenkeller oder hinter der Bühne funktioniert der Scan-Ablauf nicht — und
genau dort wird er gebraucht. Das ist die größte Lücke gegenüber dem eigenen
Anspruch, aber auch die teuerste.

### C5 · Karte fehlt trotz Zusage im Konzept

KONZEPT.md nennt Leaflet und eine Kartenansicht „zuletzt gesehen". Umgesetzt ist
nur ein Link auf einen externen Kartendienst.

### C6 · Weitere Roadmap-Punkte, unverändert offen

Verleih/Checkout an Dritte · E-Mail-Benachrichtigungen · Serien-Anlage (acht gleiche
Scheinwerfer in einem Zug) · Reparaturkosten-Historie · Betriebsstunden als
Wartungsauslöser.

---

## Der Plan

Fünf Stufen. Die Reihenfolge ist bewusst: erst darf man der App vertrauen, dann wird
sie einfach, dann wird sie stärker.

### Stufe 1 — Vertrauen (Voraussetzung für alles) — abgeschlossen 23.08.2026

| Was | Warum | Stand |
|---|---|---|
| Passwort zurücksetzen und ändern (A1) | Ohne das ist die App nicht auslieferbar | ✅ erledigt |
| Letzten Admin schützen (A1) | Sonst sperrt man sich selbst aus | ✅ war bereits vorhanden, jetzt durch Tests belegt |
| Anmeldung gegen Durchprobieren schützen (A3) | Sobald sie öffentlich steht | ✅ erledigt |
| Export: Inventar als CSV und PDF (A2) | Versicherung, Steuer, Übergabe | ✅ erledigt |
| Packliste als PDF (A2) | Nimmt man ohnehin ausgedruckt mit | ✅ erledigt |
| Tests für die rechnenden Teile (A4) | Fälligkeit, Konflikte, Umbuchung, Import | ✅ Grundstock: 63 Tests, CI-Sperre |

Nicht in dieser Stufe erledigt und bewusst offen geblieben:

- **Prüfnachweise als PDF-Sammlung** (Teil von A2) — gehört zu den Prüfprotokollen.
- **Tests für Case-Umbuchung und CSV-Import** (Teil von A4) — beide stecken in
  Server-Aktionen mit `requireUser`, brauchen also einen Request-Kontext im Test.
- **A5 (Sicherung im laufenden Betrieb)** war nie Teil von Stufe 1.

### Stufe 2 — Der Einsatzmodus (die eigentliche Antwort auf „einfach")

Ein laufender Auftrag, den man einmal wählt und der danach alles steuert.

| Was | Warum | Aufwand |
|---|---|---|
| „Einsatz starten" auf dem Event: packen / aufbauen / abbauen / zurückräumen | Ein Modus statt vieler Bildschirme | ~2 Tage |
| Scan hakt im aktiven Modus direkt ab, statt nur die Geräteseite zu zeigen | Der Scan bekommt endlich Bedeutung | ~1,5 Tage |
| Dauer-Scan: Gerät nach Gerät ohne Zwischenklick, mit Ton und Fortschritt | So arbeitet man beim Verladen wirklich | ~1,5 Tage |
| Dashboard zeigt den laufenden Einsatz statt Zählern (B1) | Beantwortet „was ist jetzt zu tun" | ~1 Tag |
| Packliste als echte Arbeitsliste, offen statt zugeklappt (B2) | Die Liste ist der Zweck der Seite | ~1 Tag |
| Planung von der Ausführung trennen | In der Halle keine Verwaltungsknöpfe | ~0,5 Tage |

### Stufe 3 — Bedienung entschlacken

| Was | Aufwand |
|---|---|
| Filterwand hinter einen Knopf, Zeilen zeigen Case/Event/Fälligkeit (B2) | ~1,5 Tage |
| Untere Leiste und „Mehr" nach Arbeitshäufigkeit ordnen (B3) | ~1 Tag |
| Feedback-Knopf aus dem Weg räumen (B4) | ~1 Std. |
| Scan-Seite: verständliche Hilfe je System statt Fehlertext (B5) | ~0,5 Tage |
| Seitentitel ergänzen (B6) · Entsperren nach bestandener Prüfung (B7) | ~0,5 Tage |

### Stufe 4 — Fachlich stärker

| Was | Aufwand |
|---|---|
| Mengenartikel mit Entnahme und Rückgabe (C1) | ~3 Tage |
| Gewicht- und Stromlast-Summen je Event und Case (C2) | ~1,5 Tage |
| Serien-Anlage: acht gleiche Geräte in einem Zug (C6) | ~0,5 Tage |
| Kalenderansicht (C3) | ~1,5 Tage |

### Stufe 5 — Ausbau

Offline-Modus (C4, eigenes Vorhaben, ~5–8 Tage) · Verleih an Dritte ·
E-Mail-Benachrichtigungen · Kartenansicht · Betriebsstunden.

---

## Womit ich anfangen würde

**Stufe 1 zuerst, ohne Diskussion.** Nicht weil es das Spannendste ist, sondern weil
ein vergessenes Passwort heute Datenbank-Chirurgie erfordert und du deine eigenen
Daten nicht herausbekommst. Das sind ein bis zwei Wochen, danach ist OnTrack ein
Werkzeug, dem man einen echten Bestand anvertrauen kann.

**Dann Stufe 2 am Stück.** Der Einsatzmodus ist die Antwort auf deine Kritik. Häppchenweise
umgesetzt bringt er nichts — er wirkt erst, wenn Scan, Dashboard und Packliste
zusammen umgestellt sind. Danach ist die App im Feld tatsächlich einfach: Einsatz
wählen, scannen, fertig.

**Stufe 3 und 4 nach Bedarf**, gern gemischt — das sind einzeln nutzbare Verbesserungen.

**Vorher noch:** Es gibt bis heute keine einzige echte Rückmeldung. Die
Feedback-Funktion ist eingebaut, hatte aber nie eine laufende Instanz. Seit v1.0.0
gibt es Desktop-Installer — der schnellste Weg zu echtem Feedback, den dieses
Projekt je hatte. Was ein echter Nutzer nach zwei Wochen vermisst, schlägt jede
Liste, die hier steht — auch diese.
