import "server-only";
import { headers } from "next/headers";

/**
 * Woher kommt diese Anfrage?
 *
 * Die Antwort ist die Grundlage jeder Bremse, die „je Herkunft" zählt — und
 * sie ist nur so gut wie der Reverse Proxy davor. Next.js sieht die
 * Verbindungsadresse selbst nicht; was ankommt, ist das, was ein Proxy in
 * `X-Forwarded-For` oder `X-Real-IP` hineinschreibt.
 *
 * Der heikle Fall: Fehlt beides, fallen **alle** Besucher auf denselben
 * Schlüssel. Aus der Bremse je Adresse wird dann eine globale — 25
 * Fehlversuche von irgendwoher sperren die Anmeldung für alle. Das ist kein
 * theoretisches Risiko, sondern die übliche Folge einer Proxy-Kette, die den
 * Header nicht setzt.
 *
 * Deshalb wird die Quelle mitgeliefert und nicht verschwiegen: Wer selbst
 * hostet, muss das nachsehen können, bevor es jemandem auffällt, weil er nicht
 * mehr hereinkommt.
 */

export type Herkunft = {
  /** Der Schlüssel, unter dem gezählt wird. */
  key: string;
  quelle: "x-forwarded-for" | "x-real-ip" | "unbekannt";
};

/** Die reine Auswertung, ohne Zugriff auf die Anfrage — damit prüfbar. */
export function leseHerkunft(
  forwarded: string | null | undefined,
  realIp: string | null | undefined
): Herkunft {
  // Bei einer Kette von Proxys steht der ursprüngliche Absender vorne.
  const ersteAdresse = (forwarded ?? "").split(",")[0]?.trim();
  if (ersteAdresse) return { key: ersteAdresse, quelle: "x-forwarded-for" };

  const real = (realIp ?? "").trim();
  if (real) return { key: real, quelle: "x-real-ip" };

  return { key: "lokal", quelle: "unbekannt" };
}

export async function herkunft(): Promise<Herkunft> {
  const h = await headers();
  return leseHerkunft(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

/** Nur der Schlüssel — für die Aufrufer, die die Quelle nicht brauchen. */
export async function herkunftsSchluessel(): Promise<string> {
  return (await herkunft()).key;
}
