"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import QrScanner from "@/components/QrScanner";
import { NfcReadButton } from "@/components/NfcReadButton";
import { MISSION_PHASES, type MissionPhase } from "@/lib/constants";
import {
  addToMissionAction,
  scanIntoMissionAction,
  type ScanOutcome,
} from "./actions";

type Props = {
  phase: MissionPhase;
  eventId: string;
  eventName: string;
  erledigt: number;
  gesamt: number;
};

type Eintrag = {
  id: number;
  outcome: ScanOutcome;
  zeit: string;
};

/**
 * Kurzer Ton als Rückmeldung.
 *
 * Beim Verladen schaut niemand auf den Bildschirm — man hört, ob der Scan
 * gesessen hat. Erzeugt statt einer Audiodatei, damit nichts nachgeladen
 * werden muss und es auch offline funktioniert.
 */
function tonAbspielen(art: "ok" | "schon" | "fehler") {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const jetzt = ctx.currentTime;
    const frequenz = art === "ok" ? 880 : art === "schon" ? 520 : 220;
    const dauer = art === "fehler" ? 0.32 : 0.12;

    osc.frequency.setValueAtTime(frequenz, jetzt);
    osc.type = art === "fehler" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(0.001, jetzt);
    gain.gain.exponentialRampToValueAtTime(0.25, jetzt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, jetzt + dauer);

    osc.start(jetzt);
    osc.stop(jetzt + dauer + 0.02);
    osc.onended = () => ctx.close();
  } catch {
    // Ton ist Beiwerk — ohne ihn funktioniert der Scan genauso.
  }
}

function vibrieren(art: "ok" | "schon" | "fehler") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(art === "fehler" ? [90, 60, 90] : art === "schon" ? 30 : 60);
}

function artVon(outcome: ScanOutcome): "ok" | "schon" | "fehler" {
  if (outcome.kind === "gebucht") return "ok";
  if (outcome.kind === "schon") return "schon";
  return "fehler";
}

function farbeVon(outcome: ScanOutcome): string {
  switch (outcome.kind) {
    case "gebucht":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "schon":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "fremd":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    default:
      return "border-red-500/40 bg-red-500/10 text-red-300";
  }
}

function textVon(outcome: ScanOutcome, phase: MissionPhase): string {
  switch (outcome.kind) {
    case "gebucht":
      return outcome.anzahl > 1
        ? `${outcome.name}: ${outcome.anzahl} Geräte ${MISSION_PHASES[phase].action}`
        : `${outcome.name} ${MISSION_PHASES[phase].action}`;
    case "schon":
      return `${outcome.name} war schon ${MISSION_PHASES[phase].action}`;
    case "fremd":
      return `${outcome.name} gehört nicht zu diesem Einsatz`;
    case "unbekannt":
      return `Unbekannter Code: ${outcome.code}`;
    case "fehler":
      return outcome.nachricht;
  }
}

export function EinsatzClient({ phase, eventId, eventName, erledigt, gesamt }: Props) {
  const [stand, setStand] = useState({ erledigt, gesamt });
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [manuell, setManuell] = useState("");
  const [, startTransition] = useTransition();
  const laufNr = useRef(0);
  const inArbeit = useRef(false);

  const verarbeite = useCallback(
    async (code: string) => {
      // Der Scanner feuert weiter, während der Server antwortet. Ohne diese
      // Sperre würde dasselbe Gerät mehrfach gebucht.
      if (inArbeit.current) return;
      inArbeit.current = true;

      try {
        const antwort = await scanIntoMissionAction(code);
        const art = artVon(antwort.outcome);
        tonAbspielen(art);
        vibrieren(art);

        if (antwort.fortschritt) setStand(antwort.fortschritt);
        laufNr.current += 1;
        setEintraege((bisher) =>
          [
            {
              id: laufNr.current,
              outcome: antwort.outcome,
              zeit: new Date().toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            },
            ...bisher,
          ].slice(0, 12)
        );
      } finally {
        inArbeit.current = false;
      }
    },
    []
  );

  const nachtragen = (deviceId: string) => {
    startTransition(async () => {
      const antwort = await addToMissionAction(deviceId);
      tonAbspielen("ok");
      if (antwort.fortschritt) setStand(antwort.fortschritt);
      laufNr.current += 1;
      setEintraege((bisher) =>
        [
          {
            id: laufNr.current,
            outcome: antwort.outcome,
            zeit: new Date().toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...bisher,
        ].slice(0, 12)
      );
    });
  };

  const prozent = stand.gesamt > 0 ? Math.round((stand.erledigt / stand.gesamt) * 100) : 0;
  const fertig = stand.gesamt > 0 && stand.erledigt === stand.gesamt;

  return (
    <div className="flex flex-col gap-4">
      {/* Fortschritt — das Wichtigste, immer sichtbar */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{MISSION_PHASES[phase].label}</p>
            <p className="text-lg font-semibold leading-tight">{eventName}</p>
          </div>
          <p className="text-3xl font-bold tabular-nums shrink-0">
            {stand.erledigt}
            <span className="text-muted text-lg">/{stand.gesamt}</span>
          </p>
        </div>

        <div
          className="h-3 w-full rounded-full bg-surface-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={stand.erledigt}
          aria-valuemin={0}
          aria-valuemax={stand.gesamt}
          aria-label={`${MISSION_PHASES[phase].label}: ${stand.erledigt} von ${stand.gesamt}`}
        >
          <div
            className={`h-full transition-all duration-300 ${fertig ? "bg-emerald-500" : "bg-accent"}`}
            style={{ width: `${prozent}%` }}
          />
        </div>

        {fertig && (
          <p className="text-sm text-emerald-400 font-medium">
            Alle Geräte {MISSION_PHASES[phase].action}.
          </p>
        )}
      </div>

      {/* Dauer-Scan */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">{MISSION_PHASES[phase].hint} — es geht ohne Zwischenklick weiter.</p>
        <QrScanner onCode={verarbeite} />
        <NfcReadButton onCode={verarbeite} />
      </div>

      {/* Manuelle Eingabe als Rückfallebene */}
      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="einsatz-manuell">
          Ohne Kamera: Nummer eintippen
        </label>
        <div className="flex gap-3">
          <input
            id="einsatz-manuell"
            className="input flex-1"
            placeholder="z. B. OT-0001"
            value={manuell}
            onChange={(e) => setManuell(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const wert = manuell.trim();
              if (!wert) return;
              setManuell("");
              void verarbeite(wert);
            }}
          />
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={() => {
              const wert = manuell.trim();
              if (!wert) return;
              setManuell("");
              void verarbeite(wert);
            }}
          >
            Buchen
          </button>
        </div>
      </div>

      {/* Verlauf */}
      {eintraege.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Zuletzt gescannt</h2>
          <ul className="flex flex-col gap-2">
            {eintraege.map((e) => (
              <li
                key={e.id}
                className={`rounded-xl border px-3 py-2.5 text-sm flex items-start justify-between gap-3 ${farbeVon(e.outcome)}`}
              >
                <span>{textVon(e.outcome, phase)}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {e.outcome.kind === "fremd" && (
                    <button
                      type="button"
                      className="underline whitespace-nowrap"
                      onClick={() => nachtragen(e.outcome.kind === "fremd" ? e.outcome.deviceId : "")}
                    >
                      aufnehmen
                    </button>
                  )}
                  <span className="tabular-nums opacity-70">{e.zeit}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={`/events/${eventId}`} className="btn-secondary text-center">
        Zur Packliste
      </Link>
    </div>
  );
}
