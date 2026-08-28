import { describe, expect, it } from "vitest";
import { codeVorschlag, einladungNoetig, pruefeEinladung } from "@/lib/registration";

/**
 * Diese Regel entscheidet, wer überhaupt an das System kommt. Zwei Fehler
 * wären teuer und würden gegensätzlich wehtun:
 *
 * - Zu streng: Eine frische Installation lässt sich nicht einrichten, weil
 *   der erste Benutzer einen Code bräuchte, den niemand hinterlegen kann.
 * - Zu lasch: Eine öffentlich erreichbare Instanz nimmt Anträge von jedem an.
 */

const OFFEN = { hinterlegt: "", eingegeben: "", ersterBenutzer: false };

describe("Ohne hinterlegten Code", () => {
  it("darf sich jeder registrieren", () => {
    expect(pruefeEinladung(OFFEN)).toEqual({ erlaubt: true });
  });

  it("gilt auch bei null oder undefined als offen", () => {
    expect(pruefeEinladung({ ...OFFEN, hinterlegt: null })).toEqual({ erlaubt: true });
    expect(pruefeEinladung({ ...OFFEN, hinterlegt: undefined })).toEqual({ erlaubt: true });
  });

  it("lässt ein Feld aus lauter Leerzeichen nicht als Code durchgehen", () => {
    // Sonst wäre die Instanz für alle gesperrt, ohne dass jemand einen Code
    // kennt — und niemand käme mehr hinein.
    expect(einladungNoetig("   ", false)).toBe(false);
  });
});

describe("Der allererste Benutzer", () => {
  it("kommt immer durch, auch bei hinterlegtem Code", () => {
    // Es gibt noch keinen Admin, der einen Code vergeben könnte. Ohne diese
    // Ausnahme wäre jede Neuinstallation tot — auch jede Desktop-Fassung.
    const ergebnis = pruefeEinladung({
      hinterlegt: "GEHEIM",
      eingegeben: "",
      ersterBenutzer: true,
    });
    expect(ergebnis).toEqual({ erlaubt: true });
  });

  it("braucht dann auch kein Feld im Formular", () => {
    expect(einladungNoetig("GEHEIM", true)).toBe(false);
  });
});

describe("Mit hinterlegtem Code", () => {
  const lage = { hinterlegt: "KXQP-7M4T", ersterBenutzer: false };

  it("verlangt ihn", () => {
    expect(einladungNoetig(lage.hinterlegt, false)).toBe(true);
  });

  it("lässt den richtigen durch", () => {
    expect(pruefeEinladung({ ...lage, eingegeben: "KXQP-7M4T" })).toEqual({ erlaubt: true });
  });

  it("meldet einen fehlenden anders als einen falschen", () => {
    // „Du hast nichts eingegeben" und „das war der falsche" sind zwei
    // verschiedene Auskünfte für den, der davorsitzt.
    expect(pruefeEinladung({ ...lage, eingegeben: "" })).toEqual({
      erlaubt: false,
      grund: "fehlt",
    });
    expect(pruefeEinladung({ ...lage, eingegeben: "FALSCH" })).toEqual({
      erlaubt: false,
      grund: "falsch",
    });
  });

  it("verzeiht Groß- und Kleinschreibung", () => {
    expect(pruefeEinladung({ ...lage, eingegeben: "kxqp-7m4t" }).erlaubt).toBe(true);
  });

  it("verzeiht mitkopierte Leerzeichen", () => {
    // Der Code kommt oft aus einer Nachricht. Ein Fehlschlag wegen eines
    // Leerzeichens wäre reine Schikane.
    expect(pruefeEinladung({ ...lage, eingegeben: "  KXQP-7M4T \n" }).erlaubt).toBe(true);
  });

  it("akzeptiert keinen Teiltreffer", () => {
    expect(pruefeEinladung({ ...lage, eingegeben: "KXQP" }).erlaubt).toBe(false);
    expect(pruefeEinladung({ ...lage, eingegeben: "KXQP-7M4T-EXTRA" }).erlaubt).toBe(false);
  });
});

describe("Codevorschlag", () => {
  // Feste Folge statt Zufall, damit der Test etwas behauptet.
  const reihum = (() => {
    let i = 0;
    return (grenze: number) => i++ % grenze;
  })();

  it("hat zwei Gruppen zu vier Zeichen", () => {
    expect(codeVorschlag(reihum)).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("meidet verwechselbare Zeichen", () => {
    // 0/O und 1/l/I am Telefon durchzugeben endet in Rückfragen.
    const viele = Array.from({ length: 50 }, () => codeVorschlag(reihum)).join("");
    expect(viele).not.toMatch(/[O01ILil]/);
  });
});
