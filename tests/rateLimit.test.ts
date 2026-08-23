import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PER_ACCOUNT,
  MAX_PER_ORIGIN,
  WINDOW_MS,
  checkLoginAllowed,
  clearLoginFailures,
  formatRetryAfter,
  recordLoginFailure,
  resetAllLoginFailures,
} from "@/lib/rateLimit";

const KONTO = "kunde@firma.de";
const HERKUNFT = "203.0.113.9";
const T0 = 1_700_000_000_000;

beforeEach(() => resetAllLoginFailures());

describe("Anmeldebremse", () => {
  it("lässt den ersten Versuch durch", () => {
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(true);
  });

  it("sperrt das Konto erst nach der erlaubten Anzahl Fehlversuche", () => {
    for (let i = 0; i < MAX_PER_ACCOUNT - 1; i++) {
      recordLoginFailure(KONTO, HERKUNFT, T0);
      expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(true);
    }
    recordLoginFailure(KONTO, HERKUNFT, T0);
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(false);
  });

  it("gibt das Konto nach Ablauf des Zeitfensters wieder frei", () => {
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) recordLoginFailure(KONTO, HERKUNFT, T0);
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(false);
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("nennt eine sinnvolle Restwartezeit", () => {
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) recordLoginFailure(KONTO, HERKUNFT, T0);
    const verdikt = checkLoginAllowed(KONTO, HERKUNFT, T0 + 60_000);
    expect(verdikt.allowed).toBe(false);
    if (!verdikt.allowed) {
      expect(verdikt.retryAfterMs).toBeGreaterThan(0);
      expect(verdikt.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
    }
  });

  it("gibt das Konto nach erfolgreicher Anmeldung sofort frei", () => {
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) recordLoginFailure(KONTO, HERKUNFT, T0);
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(false);
    clearLoginFailures(KONTO);
    expect(checkLoginAllowed(KONTO, HERKUNFT, T0).allowed).toBe(true);
  });

  it("sperrt ein Konto nicht wegen Fehlversuchen bei einem anderen", () => {
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) recordLoginFailure("opfer@firma.de", HERKUNFT, T0);
    expect(checkLoginAllowed("anderer@firma.de", "198.51.100.4", T0).allowed).toBe(true);
  });

  it("bremst auch eine Herkunft, die viele verschiedene Konten durchprobiert", () => {
    // Je Konto unter der Kontogrenze bleiben — greifen darf nur die Herkunftsgrenze.
    for (let i = 0; i < MAX_PER_ORIGIN; i++) {
      recordLoginFailure(`opfer${i}@firma.de`, HERKUNFT, T0);
    }
    expect(checkLoginAllowed("noch-eins@firma.de", HERKUNFT, T0).allowed).toBe(false);
  });

  it("formuliert die Wartezeit verständlich", () => {
    expect(formatRetryAfter(30_000)).toBe("einer Minute");
    expect(formatRetryAfter(4 * 60_000)).toBe("4 Minuten");
  });
});
