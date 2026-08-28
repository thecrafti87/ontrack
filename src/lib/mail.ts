import "server-only";

/**
 * E-Mail-Versand über HTTP statt SMTP.
 *
 * Zwei Gründe für `fetch` gegen eine Anbieter-Schnittstelle:
 *
 * 1. Kein zusätzliches Paket, kein SMTP-Port, der in irgendeiner Firewall
 *    hängen bleibt. Ein HTTPS-Aufruf geht überall raus.
 * 2. Es läuft auch dort, wo kein Node-Prozess steht. Sollte OnTrack je auf
 *    eine Umgebung ohne Dateisystem umziehen, überlebt dieser Teil den Umzug.
 *
 * Ohne Konfiguration passiert nichts — und zwar still. Eine Instanz ohne
 * Maildienst ist der Normalfall (Desktop-App, lokaler Test), und eine
 * Fehlermeldung bei jedem Feedback wäre dort nur Lärm.
 */

export type MailErgebnis =
  | { art: "gesendet" }
  | { art: "nicht_eingerichtet" }
  | { art: "fehler"; grund: string };

type MailAuftrag = {
  betreff: string;
  /** Reiner Text. Absichtlich kein HTML: Es geht um Lesbarkeit, nicht um Gestaltung. */
  text: string;
  /** Antwortadresse, falls direkt zurückgeschrieben werden soll. */
  antwortAn?: string | null;
};

/** Was gesetzt sein muss, damit überhaupt versendet wird. */
function konfiguration() {
  const key = process.env.ONTRACK_RESEND_KEY?.trim();
  const an = process.env.ONTRACK_MAIL_TO?.trim();
  // Resend verlangt einen verifizierten Absender. onboarding@resend.dev
  // funktioniert ohne eigene Domain, aber nur an die eigene Adresse.
  const von = process.env.ONTRACK_MAIL_FROM?.trim() || "OnTrack <onboarding@resend.dev>";

  if (!key || !an) return null;
  return { key, an, von };
}

/** Ist der Mailversand eingerichtet? Für Hinweise in der Oberfläche. */
export function mailEingerichtet(): boolean {
  return konfiguration() !== null;
}

/**
 * Eine Nachricht verschicken.
 *
 * Wirft nie. Der Aufrufer entscheidet, ob ihn das Ergebnis interessiert —
 * beim Feedback tut es das ausdrücklich nicht: Die Meldung ist gespeichert,
 * ob die Mail ankommt, ändert daran nichts.
 */
export async function sendeMail(auftrag: MailAuftrag): Promise<MailErgebnis> {
  const konf = konfiguration();
  if (!konf) return { art: "nicht_eingerichtet" };

  try {
    const antwort = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${konf.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: konf.von,
        to: [konf.an],
        subject: auftrag.betreff,
        text: auftrag.text,
        ...(auftrag.antwortAn ? { reply_to: auftrag.antwortAn } : {}),
      }),
      // Ohne Frist könnte ein hängender Maildienst die Server-Aktion
      // festhalten, die längst fertig ist.
      signal: AbortSignal.timeout(10_000),
    });

    if (!antwort.ok) {
      const körper = await antwort.text().catch(() => "");
      return { art: "fehler", grund: `${antwort.status} ${körper.slice(0, 200)}` };
    }

    return { art: "gesendet" };
  } catch (fehler) {
    return { art: "fehler", grund: fehler instanceof Error ? fehler.message : String(fehler) };
  }
}

/**
 * Feedback als Mail aufbereiten.
 *
 * Reiner Text, alles Wichtige in den ersten Zeilen: Wer, wo, was. Wer das
 * auf dem Handy in der Vorschau liest, soll ohne Öffnen wissen, worum es
 * geht — deshalb steht die Nachricht selbst schon im Betreff.
 */
export function feedbackMail(eingang: {
  nachricht: string;
  autor: string;
  autorMail: string;
  seite: string;
  zeitpunkt: Date;
  adresse: string;
}): MailAuftrag {
  const kurz =
    eingang.nachricht.length > 60
      ? `${eingang.nachricht.slice(0, 60).trimEnd()} …`
      : eingang.nachricht;

  return {
    betreff: `OnTrack-Feedback von ${eingang.autor}: ${kurz}`,
    antwortAn: eingang.autorMail || null,
    text: [
      eingang.nachricht,
      "",
      "—",
      `Von:      ${eingang.autor} <${eingang.autorMail}>`,
      `Seite:    ${eingang.seite || "(keine)"}`,
      `Zeit:     ${eingang.zeitpunkt.toLocaleString("de-DE")}`,
      "",
      `Alle Meldungen: ${eingang.adresse}/feedback`,
    ].join("\n"),
  };
}
