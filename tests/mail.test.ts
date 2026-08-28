import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feedbackMail, mailEingerichtet, sendeMail } from "@/lib/mail";

/**
 * Der Versand selbst gehört dem Anbieter. Prüfenswert ist, was davor
 * entschieden wird: Wird überhaupt gesendet, und steht das Wichtige drin?
 *
 * Die härteste Regel dabei ist die stille: Ohne Konfiguration darf nichts
 * passieren und nichts scheitern. Eine Desktop-Installation hat keinen
 * Maildienst — dort wäre jede Fehlermeldung nur Lärm.
 */

const EINGANG = {
  nachricht: "Der Scan piept zweimal, wenn das Gerät schon gepackt war.",
  autor: "Benni",
  autorMail: "benni@example.test",
  seite: "/einsatz",
  zeitpunkt: new Date("2026-08-28T14:38:00"),
  adresse: "https://ontrack.beispiel.de",
};

const UMGEBUNG = { ...process.env };

beforeEach(() => {
  delete process.env.ONTRACK_RESEND_KEY;
  delete process.env.ONTRACK_MAIL_TO;
  delete process.env.ONTRACK_MAIL_FROM;
});

afterEach(() => {
  process.env = { ...UMGEBUNG };
  vi.unstubAllGlobals();
});

describe("Ohne Konfiguration", () => {
  it("gilt der Versand als nicht eingerichtet", () => {
    expect(mailEingerichtet()).toBe(false);
  });

  it("wird nichts verschickt und nichts geworfen", async () => {
    const abruf = vi.fn();
    vi.stubGlobal("fetch", abruf);

    await expect(sendeMail({ betreff: "x", text: "y" })).resolves.toEqual({
      art: "nicht_eingerichtet",
    });
    expect(abruf, "es darf kein Netzaufruf stattfinden").not.toHaveBeenCalled();
  });

  it("genügt ein halb gesetzter Satz Angaben nicht", () => {
    // Nur ein Schlüssel ohne Empfänger wäre eine Mail ins Nichts.
    process.env.ONTRACK_RESEND_KEY = "re_test";
    expect(mailEingerichtet()).toBe(false);

    delete process.env.ONTRACK_RESEND_KEY;
    process.env.ONTRACK_MAIL_TO = "chef@example.test";
    expect(mailEingerichtet()).toBe(false);
  });
});

describe("Mit Konfiguration", () => {
  beforeEach(() => {
    process.env.ONTRACK_RESEND_KEY = "re_test";
    process.env.ONTRACK_MAIL_TO = "chef@example.test";
  });

  it("schickt Betreff, Text und Empfänger an den Dienst", async () => {
    const abruf = vi.fn(
      async (_url: string, _optionen: RequestInit) => new Response("{}", { status: 200 })
    );
    vi.stubGlobal("fetch", abruf);

    const ergebnis = await sendeMail({ betreff: "Betreff", text: "Inhalt", antwortAn: "a@b.test" });

    expect(ergebnis).toEqual({ art: "gesendet" });
    const optionen = abruf.mock.calls[0]![1];
    const körper = JSON.parse(String(optionen.body));
    expect(körper.to).toEqual(["chef@example.test"]);
    expect(körper.subject).toBe("Betreff");
    expect(körper.text).toBe("Inhalt");
    expect(körper.reply_to).toBe("a@b.test");
  });

  it("meldet einen Fehler, statt ihn zu werfen", async () => {
    // Der Aufrufer speichert bereits gespeichertes Feedback nicht zurück,
    // nur weil der Maildienst hustet.
    vi.stubGlobal("fetch", async () => new Response("kaputt", { status: 500 }));

    const ergebnis = await sendeMail({ betreff: "x", text: "y" });
    expect(ergebnis.art).toBe("fehler");
  });

  it("fängt auch einen Netzabbruch ab", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });

    const ergebnis = await sendeMail({ betreff: "x", text: "y" });
    expect(ergebnis).toEqual({ art: "fehler", grund: "getaddrinfo ENOTFOUND" });
  });

  it("lässt einen fehlenden Absender nicht zum Ausschlusskriterium werden", () => {
    // Ohne eigene Domain gibt es einen brauchbaren Standardabsender.
    expect(mailEingerichtet()).toBe(true);
  });
});

describe("Feedback als Mail", () => {
  it("stellt die Nachricht schon in den Betreff", () => {
    // In der Handy-Vorschau soll ohne Öffnen erkennbar sein, worum es geht.
    const mail = feedbackMail(EINGANG);
    expect(mail.betreff).toContain("Benni");
    expect(mail.betreff).toContain("Der Scan piept zweimal");
  });

  it("kürzt lange Nachrichten im Betreff", () => {
    const mail = feedbackMail({ ...EINGANG, nachricht: "A".repeat(200) });
    expect(mail.betreff.length).toBeLessThan(120);
    expect(mail.betreff).toContain("…");
  });

  it("nennt Verfasser, Seite und Zeit im Text", () => {
    const mail = feedbackMail(EINGANG);
    expect(mail.text).toContain("benni@example.test");
    expect(mail.text).toContain("/einsatz");
    expect(mail.text).toContain("28.8.2026");
  });

  it("verlinkt die Liste aller Meldungen", () => {
    expect(feedbackMail(EINGANG).text).toContain("https://ontrack.beispiel.de/feedback");
  });

  it("setzt die Antwortadresse auf den Verfasser", () => {
    // Antworten geht damit direkt an den, der es gemeldet hat.
    expect(feedbackMail(EINGANG).antwortAn).toBe("benni@example.test");
  });

  it("kommt ohne Seitenangabe zurecht", () => {
    const mail = feedbackMail({ ...EINGANG, seite: "" });
    expect(mail.text).toContain("(keine)");
  });
});
