/**
 * Bremse für wiederholte Fehlversuche bei der Anmeldung.
 *
 * Bewusst im Arbeitsspeicher statt in der Datenbank: OnTrack läuft als ein
 * einzelner Prozess (SQLite, Desktop-App oder ein Container), damit genügt eine
 * Map. Das kostet keine Tabelle, keine Aufräumaufgabe und keinen Schreibzugriff
 * pro Anmeldeversuch. Der Preis: ein Neustart setzt die Zähler zurück. Das ist
 * vertretbar, weil ein Angreifer den Neustart nicht auslösen kann.
 *
 * Die Funktionen nehmen `now` als Parameter, damit sie ohne Warten prüfbar sind.
 */

/** Zeitfenster, über das Fehlversuche gezählt werden. */
export const WINDOW_MS = 15 * 60 * 1000;

/** Fehlversuche je Konto, bevor gesperrt wird. */
export const MAX_PER_ACCOUNT = 5;

/**
 * Fehlversuche je Herkunftsadresse. Deutlich höher: hinter einem gemeinsamen
 * Anschluss (Firmen-WLAN, Mobilfunk) teilen sich mehrere Personen eine Adresse.
 */
export const MAX_PER_ORIGIN = 25;

type Attempt = { times: number[] };

const buckets = new Map<string, Attempt>();

/** Zeitstempel außerhalb des Fensters verwerfen; leere Einträge entfernen. */
function prune(key: string, now: number): number[] {
  const bucket = buckets.get(key);
  if (!bucket) return [];
  const fresh = bucket.times.filter((t) => now - t < WINDOW_MS);
  if (fresh.length === 0) {
    buckets.delete(key);
    return [];
  }
  bucket.times = fresh;
  return fresh;
}

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Darf ein weiterer Versuch stattfinden? Prüft Konto und Herkunft getrennt,
 * das strengere Ergebnis gewinnt.
 */
export function checkLoginAllowed(
  accountKey: string,
  originKey: string,
  now: number = Date.now()
): RateLimitVerdict {
  const checks: Array<[string, number]> = [
    [`a:${accountKey}`, MAX_PER_ACCOUNT],
    [`o:${originKey}`, MAX_PER_ORIGIN],
  ];

  let longestWait = 0;
  for (const [key, max] of checks) {
    const times = prune(key, now);
    if (times.length < max) continue;
    // Gesperrt, bis der älteste noch zählende Versuch aus dem Fenster fällt.
    const oldest = Math.min(...times);
    longestWait = Math.max(longestWait, WINDOW_MS - (now - oldest));
  }

  if (longestWait > 0) return { allowed: false, retryAfterMs: longestWait };
  return { allowed: true };
}

/** Einen Fehlversuch vermerken. */
export function recordLoginFailure(
  accountKey: string,
  originKey: string,
  now: number = Date.now()
): void {
  for (const key of [`a:${accountKey}`, `o:${originKey}`]) {
    prune(key, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.times.push(now);
    else buckets.set(key, { times: [now] });
  }
}

/** Nach erfolgreicher Anmeldung: Zähler des Kontos zurücksetzen. */
export function clearLoginFailures(accountKey: string): void {
  buckets.delete(`a:${accountKey}`);
}

/** Nur für Tests: kompletter Neuanfang. */
export function resetAllLoginFailures(): void {
  buckets.clear();
}

/** Wartezeit für Menschen formulieren. */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "einer Minute";
  return `${minutes} Minuten`;
}

// ── Meldungen ohne Anmeldung ─────────────────────────────────────────────

/**
 * Störungsmeldungen je Herkunftsadresse und Zeitfenster.
 *
 * Der Unterschied zur Anmeldebremse ist wichtig: Dort werden **Fehlversuche**
 * gezählt, hier **jede** Absendung. Eine öffentliche Schreibmöglichkeit ohne
 * Konto lässt sich nicht an einem Fehlschlag erkennen — jede Meldung sieht aus
 * wie eine echte.
 *
 * Fünf in einer Viertelstunde reichen für den ehrlichen Fall: Wer wirklich
 * mehrere defekte Lampen findet, meldet sie nicht im Sekundentakt.
 */
export const MAX_REPORTS_PER_ORIGIN = 5;

export function checkReportAllowed(
  originKey: string,
  now: number = Date.now()
): RateLimitVerdict {
  const times = prune(`r:${originKey}`, now);
  if (times.length < MAX_REPORTS_PER_ORIGIN) return { allowed: true };
  const oldest = Math.min(...times);
  return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldest) };
}

export function recordReport(originKey: string, now: number = Date.now()): void {
  const key = `r:${originKey}`;
  prune(key, now);
  const bucket = buckets.get(key);
  if (bucket) bucket.times.push(now);
  else buckets.set(key, { times: [now] });
}
