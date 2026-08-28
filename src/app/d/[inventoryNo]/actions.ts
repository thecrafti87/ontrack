"use server";

import { prisma } from "@/lib/prisma";
import { herkunftsSchluessel } from "@/lib/originKey";
import { MELDUNG_DANK, pruefeMeldung } from "@/lib/externalReport";
import { checkReportAllowed, formatRetryAfter, recordReport } from "@/lib/rateLimit";

/**
 * Eine Störung melden, ohne angemeldet zu sein.
 *
 * Der Weg dahin ist der QR-Code am Gerät — jemand steht vor einer Lampe in
 * einer Festinstallation, hat kein Konto und wird auch keins bekommen.
 *
 * Drei Entscheidungen halten diesen Zugang beherrschbar:
 *
 * 1. **Es entsteht keine Fehlermeldung, sondern eine Vorstufe.** Wer ohne
 *    Konto meldet, sperrt kein Gerät. Erst wenn jemand aus dem Team die
 *    Meldung übernimmt, wird daraus eine Fehlermeldung mit Verantwortlichem.
 * 2. **Abschaltbar, und zwar standardmäßig aus.** Eine öffentlich erreichbare
 *    Instanz bekommt keine offene Schreibmöglichkeit, ohne dass jemand das
 *    ausdrücklich einschaltet.
 * 3. **Gebremst je Herkunft.** Ohne Bremse ist ein offenes Textfeld im Netz
 *    eine Frage von Stunden.
 *
 * Die Antwort ist immer dieselbe — auch bei unbekannter Nummer. Sonst ließe
 * sich mit ein paar hundert Anfragen der Bestand abfragen.
 */

export type MeldungsState =
  | { erfolg: string }
  | { fehler: string; feld?: "code" | "beschreibung" }
  | undefined;

export async function meldeStoerungAction(
  _prevState: MeldungsState,
  formData: FormData
): Promise<MeldungsState> {
  const eingeschaltet = await prisma.setting.findUnique({ where: { key: "publicReports" } });
  if (eingeschaltet?.value !== "an") {
    return { fehler: "Meldungen ohne Anmeldung sind für diese Instanz nicht freigeschaltet." };
  }

  const woher = await herkunftsSchluessel();
  const erlaubt = checkReportAllowed(woher);
  if (!erlaubt.allowed) {
    return {
      fehler: `Es sind gerade viele Meldungen von hier eingegangen. Bitte in ${formatRetryAfter(
        erlaubt.retryAfterMs
      )} erneut versuchen.`,
    };
  }

  const geprueft = pruefeMeldung({
    code: String(formData.get("code") ?? ""),
    beschreibung: String(formData.get("beschreibung") ?? ""),
    kontakt: String(formData.get("kontakt") ?? ""),
  });

  if (!geprueft.ok) {
    return { fehler: geprueft.meldung, feld: geprueft.feld };
  }

  // Gezählt wird erst die angenommene Meldung: Ein Tippfehler im Textfeld soll
  // niemandem sein Kontingent kosten.
  recordReport(woher);

  // Die Zuordnung passiert still. Ob sie gelingt, erfährt der Melder nicht.
  const geraet =
    (await prisma.device.findUnique({
      where: { inventoryNo: geprueft.werte.code },
      select: { id: true },
    })) ??
    (await prisma.device.findFirst({
      where: { serialNo: geprueft.werte.code },
      select: { id: true },
    }));

  await prisma.externalReport.create({
    data: {
      code: geprueft.werte.code,
      deviceId: geraet?.id ?? null,
      description: geprueft.werte.beschreibung,
      contact: geprueft.werte.kontakt,
    },
  });

  return { erfolg: MELDUNG_DANK };
}
