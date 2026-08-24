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

### B2 · Listen beginnen mit einer Filterwand — behoben (23.08.2026)

Die Geräteliste zeigt vier Bedienelemente übereinander — Suche, Kategorie,
Sortierung, Status-Chips — bevor ein einziges Gerät erscheint. Auf dem Handy ist die
Chip-Reihe abgeschnitten („Gesperr…"), der Suchtext ebenfalls („…Kate").

**Statt dessen:** Suche sichtbar, alles andere hinter *einem* Filter-Knopf mit
Trefferanzahl. Und die Zeilen sollten zeigen, was im Einsatz zählt: in welchem Case,
auf welchem Event, Prüfung fällig — statt nur des Status.

**Umgesetzt:** Nur noch Suchfeld und ein „Filter"-Knopf mit der Zahl gesetzter
Filter. Kategorie, Sortierung und Status-Chips liegen im Klappfach. Gesetzte
Filter bleiben als abwählbare Marken sichtbar, auch wenn das Fach zu ist — sonst
filtert man unbemerkt und wundert sich über fehlende Geräte. Die Zeilen zeigen
jetzt Case beziehungsweise Standort, den nächsten Einsatz mit Datum und eine
Marke „Prüfung fällig" bei überfälliger Wartung.

### B3 · Die untere Leiste passt nicht zur Arbeit — Desktop erledigt (23.08.2026)

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

**Behoben (23.08.2026), in zwei Schritten:** Zuerst brach die Leiste um
statt zu scrollen. Das machte alles sichtbar, war aber immer noch eine
flache Liste aus zwölf gleichrangigen Einträgen. Deshalb danach nach Zweck
geordnet: Vier tägliche Ziele bleiben sichtbar (Start, Einsatz, Geräte,
Events), der Rest liegt in den Gruppen „Bestand" und „Verwaltung", die bei
Klick daneben und bei Escape schließen. Die „Mehr"-Seite trägt dieselbe
Ordnung, damit Handy und Desktop nicht auseinanderlaufen. Geprüft bei 820,
1100 und 1280 px.

**Offen bleibt die untere Leiste auf dem Handy:** „Events" hat dort
weiterhin einen festen Platz. Immerhin führt der große mittlere Knopf jetzt
in den laufenden Einsatz statt in den freien Scan.

### B4 · Der Feedback-Knopf steht überall im Weg — behoben (23.08.2026)

Er schwebt auf jeder Seite über dem Inhalt, ist genauso auffällig wie der Scan-Knopf
und verdeckt auf mehreren Seiten Text. Er war für den Kundentest gedacht — im
Produkt gehört er in die Fußzeile oder unter „Mehr".

**Umgesetzt:** Unauffälliges Symbol in der Kopfleiste, auf dem Handy eine Zeile
unter „Mehr". Der Dialog ist derselbe geblieben und merkt sich weiterhin, von
welcher Seite er geöffnet wurde.

### B5 · Die Scan-Seite hilft nicht, wenn sie nicht kann — behoben (23.08.2026)

Schlägt der Kamerazugriff fehl, erscheint der technische Fehlertext
(`NotAllowedError: Permission denied`) und eine iPhone-Anleitung — auch auf Android
und am Desktop. Darunter ist die Seite leer.

**Behoben:** Der Scanner prüft jetzt `window.isSecureContext`, bevor er es
versucht, und benennt die Ursache samt aufgerufener Adresse. Vorher zeigte
er in diesem Fall einen Hinweis auf fehlende Kamera-Berechtigungen — man
suchte in den iPhone-Einstellungen nach einem Schalter, der nichts ändert.
Der Berechtigungshinweis bleibt für den Fall, dass wirklich die Freigabe
fehlt, jetzt auch mit dem Weg für Android.

**Wichtig zu wissen, unabhängig vom Code:** Kamera-Scan am Handy setzt
HTTPS voraus. Über die Netzwerkfreigabe der Desktop-App (nur HTTP) gibt es
ihn nicht — dort bleibt die manuelle Eingabe. Für den Handy-Scan im Alltag
braucht OnTrack einen Server mit HTTPS.

### B6 · Fehlende Seitentitel — behoben (23.08.2026)

`/login`, `/register` und `/scan` haben keinen Seitentitel; im Browser-Tab steht nur
„OnTrack". (Bekannt aus dem UI-Audit vom Juli, seither offen.)

### B7 · Bestandene Prüfung entsperrt nicht — behoben (23.08.2026)

Neu aufgefallen beim Bau der Prüfprotokolle: Ein durchgefallenes Gerät lässt sich
mit einem Haken sperren — aber nach bestandener Nachprüfung gibt es kein Gegenstück.
Das Entsperren bleibt Handarbeit an einer anderen Stelle.

---

## C — Fachliche Lücken

### C1 · Kabel und Kleinteile lassen sich nicht führen — behoben (24.08.2026)

Jedes Objekt braucht eine eigene Inventarnummer mit eigenem QR-Code. Für 200
DMX-Kabel, Schellen, Klemmen oder Gaffa ist das unbrauchbar — und genau diese Dinge
gehen verloren. Mengenartikel mit Stückzahl statt Einzelnummer stehen seit V1 auf
der Roadmap.

**Umgesetzt:** Eigener Bereich unter „Bestand → Mengenartikel". Bestand,
Einheit, Warnschwelle, Standort; Entnahme, Rückgabe, Zugang und
Inventurkorrektur, jeweils mit Notiz und optionaler Zuordnung zu einer
Veranstaltung. Der Bestand wird **nie direkt gesetzt**, sondern ergibt sich
aus den Bewegungen — nur so lässt sich beantworten, wohin die 40 Kabel
gegangen sind. Knappe und leere Bestände stehen oben auf der Liste.

**Bewusst offen:** Mengenartikel erscheinen **nicht** in der Packliste, nicht
im Einsatzmodus und nicht in den Gewichts-/Stromsummen. Diese drei bauen auf
Gerät-je-Datensatz auf; sie mit Stückzahlen zu verschränken ist ein eigener
Umbau. Die Zuordnung „entnommen für Veranstaltung X" bildet den Zusammenhang
vorerst ab.

### C2 · Gewicht und Stromlast werden erfasst, aber nicht genutzt — behoben (24.08.2026)

Das Gewichtsfeld pflegst du, Leistung steckt im Feldkatalog. Summiert ergäben sie
Ladungsplanung für den LKW und eine Warnung, bevor eine Zuleitung überlastet wird.
Die Daten liegen ungenutzt herum — fachlich das Eigenständigste, was die App
kurzfristig gewinnen könnte.

**Umgesetzt:** Event- und Case-Seite zeigen Gesamtgewicht und
Anschlussleistung, dazu die grobe Stromaufnahme bei 230 V und die Zahl nötiger
16-A-Kreise. Eine unvollständige Summe trägt ein „≥", und die Zahl der Geräte
ohne Angabe steht gleichberechtigt daneben — sonst plant jemand ein Fahrzeug
nach einer Zahl, die die Hälfte verschweigt.

### C3 · Kein Blick auf die Zeitachse — behoben (24.08.2026)

Es gibt keine Kalenderansicht. „Was ist wann wo im Einsatz" lässt sich nur
Event für Event beantworten.

**Umgesetzt:** Monatsansicht unter „Kalender" — am Desktop ein Raster, auf dem
Handy eine Tagesliste. Geladen wird alles, was den sichtbaren Zeitraum
berührt, auch hineinragende Veranstaltungen.

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

### Stufe 2 — Der Einsatzmodus — abgeschlossen 23.08.2026

Ein laufender Auftrag, den man einmal wählt und der danach alles steuert.

| Was | Warum | Stand |
|---|---|---|
| „Einsatz starten": packen / aufbauen / abbauen / zurückräumen | Ein Modus statt vieler Bildschirme | ✅ erledigt |
| Scan hakt im aktiven Modus direkt ab | Der Scan bekommt endlich Bedeutung | ✅ erledigt |
| Dauer-Scan mit Ton und Fortschritt | So arbeitet man beim Verladen wirklich | ✅ erledigt |
| Dashboard zeigt den laufenden Einsatz statt Zählern (B1) | Beantwortet „was ist jetzt zu tun" | ✅ erledigt |
| Packliste offen statt zugeklappt (B2) | Die Liste ist der Zweck der Seite | ✅ erledigt |
| Planung von der Ausführung trennen | In der Halle keine Verwaltungsknöpfe | ⚠️ nur teilweise |

**Zum letzten Punkt:** Der Einsatzmodus führt in eine eigene Seite ohne
Verwaltungsknöpfe, und die untere Leiste führt dorthin statt in den freien
Scan. Die Event-Seite selbst zeigt aber weiterhin alle Planungswerkzeuge —
Geräte hinzufügen, Plan hochladen, Gefahrenzone — auch während ein Einsatz
läuft. Eine echte Trennung wäre, diese Bereiche im laufenden Einsatz
einzuklappen. Bewusst offen gelassen.

**Regel, die den Kern trägt:** Ein Scan bucht nie rückwärts. Ein beim
Packen gescanntes, längst aufgebautes Gerät wird nicht zurückgestuft,
sondern als „war schon eingepackt" gemeldet. Durch Tests und einen
Browsertest abgesichert.

### Stufe 3 — Bedienung entschlacken — abgeschlossen 23.08.2026

| Was | Stand |
|---|---|
| Filterwand hinter einen Knopf, Zeilen zeigen Case/Event/Fälligkeit (B2) | ✅ erledigt |
| Untere Leiste und „Mehr" nach Arbeitshäufigkeit ordnen (B3) | ⚠️ teilweise, siehe unten |
| Feedback-Knopf aus dem Weg räumen (B4) | ✅ erledigt |
| Scan-Seite: verständliche Hilfe je System statt Fehlertext (B5) | ✅ erledigt |
| Seitentitel ergänzen (B6) · Entsperren nach bestandener Prüfung (B7) | ✅ erledigt |

**Zu B3, und das ist eine Berichtigung:** Der dort genannte Überlappungsfehler
(„das Benutzer-Kürzel N verdeckt die Beschriftung Start") **existiert nicht**.
Das „N" ist die Entwickler-Anzeige von Next.js (`nextjs-portal`) und im
Produktionsbuild nachweislich nicht vorhanden — geprüft am erzeugten HTML. Ich
hatte es aus einem Bildschirmfoto abgelesen, ohne es zu prüfen.

Die zweite Behauptung — „Events wird selten geöffnet" — ist eine ungeprüfte
Annahme. Die Reihenfolge der unteren Leiste wurde deshalb **nicht** umgestellt:
Nach zwei falschen UI-Befunden in dieser Durchsicht wäre das Umsortieren auf
Verdacht keine Verbesserung, sondern die nächste Vermutung. Umgesetzt wurde,
was belegbar war: Die „Mehr"-Seite ist nach denselben Gruppen geordnet wie das
Menüband, und der große mittlere Knopf führt in den laufenden Einsatz.

**Ehrliche Bilanz dieser Durchsicht:** Drei meiner Befunde hielten der
Nachprüfung nicht stand — der letzte Admin war längst geschützt (A1), „Feedback"
war erreichbar statt unerreichbar (B3), und die Überlappung war ein
Entwicklungsartefakt (B3). Alle drei stammten aus Bildschirmfotos und
Codelektüre ohne Messung. Was gemessen wurde, hielt.

### Stufe 4 — Fachlich stärker — abgeschlossen 24.08.2026

| Was | Stand |
|---|---|
| Mengenartikel mit Entnahme und Rückgabe (C1) | ✅ erledigt, ohne Packlisten-Anbindung |
| Gewicht- und Stromlast-Summen je Event und Case (C2) | ✅ erledigt |
| Serien-Anlage: acht gleiche Geräte in einem Zug (C6) | ✅ erledigt |
| Kalenderansicht (C3) | ✅ erledigt |

**Die eine Einschränkung:** Mengenartikel sind ein eigener Bereich und
erscheinen nicht in der Packliste, nicht im Einsatzmodus und nicht in den
Gewichts- und Stromsummen. Alle drei bauen auf „ein Datensatz je Gerät" auf;
sie mit Stückzahlen zu verschränken wäre ein eigener Umbau und gehört
entschieden, nicht nebenbei gemacht.

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
